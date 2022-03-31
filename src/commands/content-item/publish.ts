import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import augmentedDynamicContentClientFactory from '../../services/augmented-dynamic-content-client-factory';
import { FileLog } from '../../common/file-log';
import { PublishItemBuilderOptions } from '../../interfaces/publish-item-builder-options.interface';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentItem, DynamicContent, Hub, Snapshot, SnapshotType, Status } from 'dc-management-sdk-js';
import { getDefaultLogPath } from '../../common/log-helpers';
import { applyFacet, withOldFilters } from '../../common/filter/facet';

import { PublishingSnapshotResultList } from '../../augment/model/PublishingSnapshotResultList';
import { PublishingSnapshot } from '../../augment/model/PublishingSnapshot';
import { PublishingJob } from '../../augment/model/PublishingJob';

export const command = 'publish';

export const desc = 'Publish Content Items';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('item', 'publish', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .option('repoId', {
      type: 'string',
      demandOption: true,
      describe:
        'Publish content from within a given repository. Directory structure will start at the specified repository. Will automatically export all contained folders.'
    })
    .option('facet', {
      type: 'string',
      demandOption: true,
      describe:
        "Publish content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.'
    })
    .option('dryRun', {
      type: 'boolean',
      hidden: true
    })
    .option('name', {
      type: 'string',
      hidden: true
    })
    .option('schemaId', {
      type: 'string',
      hidden: true
    });
};

const getContentItems = async (
  client: DynamicContent,
  hub: Hub,
  log: FileLog,
  repoId?: string | string[]
): Promise<ContentItem[]> => {
  const items: ContentItem[] = [];

  const repoIds = typeof repoId === 'string' ? [repoId] : repoId || [];

  const repositories = await (repoId != null
    ? Promise.all(repoIds.map(id => client.contentRepositories.get(id)))
    : paginator(hub.related.contentRepositories.list));

  for (let i = 0; i < repositories.length; i++) {
    const repository = repositories[i];

    try {
      const allItems = await paginator(repository.related.contentItems.list, { status: Status.ACTIVE });

      Array.prototype.push.apply(items, allItems);
    } catch (e) {
      log.warn(`Could not get items from repository ${repository.name} (${repository.id})`, e);
      continue;
    }
  }

  return items;
};

export const handler = async (argv: Arguments<PublishItemBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { repoId, logFile, dryRun } = argv;

  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;
  const facet = withOldFilters(argv.facet, argv);

  if (!dryRun) {
    log.appendLine(
      `Due to the wide impact of this command, please ensure you are satisfied with the impact by first running with the 'dryRun' option.`
    );
  } else {
    log.appendLine(`Running in dry run mode.`);
  }

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);

  log.appendLine('Retrieving content items, please wait.');
  let items = await getContentItems(client, hub, log, repoId);

  // Filter using the facet, if present.
  if (facet) {
    items = applyFacet(items, facet);
  }

  const augmentedDynamicContent = augmentedDynamicContentClientFactory(argv);
  const publishingHub = await augmentedDynamicContent.publishinghubs.get(argv.hubId);

  if (items.length === 0) {
    log.appendLine('No items found. Exiting.');
    await log.close();
    return;
  }

  log.appendLine(`Publishing ${items.length} items.`);

  const limit = 20;
  log.appendLine(`Publishing snapshots in batches of ${limit} items.`);

  let offset = 0;
  for (let i = 0; i + offset < items.length; i += limit) {
    const batch = items.slice(i + offset, i + offset + limit);

    if (dryRun) {
      batch.forEach(item => {
        log.appendLine(`Content item snapshot published: ${item.label}, ${item.locale}, ${item.id}`);
      });
      continue;
    }

    try {
      const snapshotList: PublishingSnapshotResultList = await publishingHub.related.snapshots.create(
        batch.map(
          item =>
            new Snapshot({
              contentRoot: item.id,
              comment: '',
              createdFrom: 'content-item',
              type: SnapshotType.USER
            })
        )
      );

      snapshotList.snapshots.forEach(async snapshot => {
        const fetchedSnapshot: PublishingSnapshot = await snapshot.related.self();
        const publishingJob: PublishingJob = await fetchedSnapshot.related.publish(new Date());
        log.appendLine(
          `Content item snapshot published: ${snapshot.rootContentItem.label}, ${snapshot.locale}, ${snapshot.rootContentItem.id}, created on ${publishingJob.createdDate}`
        );
      });
    } catch (e) {
      log.appendLine(
        `Error caught while publishing batch: ${e.message}, this is likely due to an archived item. Skipping the whole batch. Check the log for more details.`
      );
      continue;
    }

    if (i == limit) {
      offset += limit;
    }
  }

  await log.close();
};
