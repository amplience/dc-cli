import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import augmentedDynamicContentClientFactory from '../../services/augmented-dynamic-content-client-factory';
import { FileLog } from '../../common/file-log';
import { PublishItemBuilderOptions } from '../../interfaces/publish-item-builder-options.interface';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentItem, Folder, DynamicContent, Hub, Snapshot, SnapshotType } from 'dc-management-sdk-js';
import { getDefaultLogPath } from '../../common/log-helpers';
import { applyFacet, withOldFilters } from '../../common/filter/facet';

import { PublishingSnapshotResultList } from '../../augment/model/PublishingSnapshotResultList';
import { PublishingSnapshotCreator } from '../../augment/model/PublishingSnapshotCreator';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('item', 'export', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .option('repoId', {
      type: 'string',
      describe:
        'Publish content from within a given repository. Directory structure will start at the specified repository. Will automatically export all contained folders.'
    })
    .option('facet', {
      type: 'string',
      describe:
        "Publish content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.'
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

  const folderIds: string[] = [];

  const repoItems: ContentItem[] = [];

  const repoIds = typeof repoId === 'string' ? [repoId] : repoId || [];

  const repositories = await (repoId != null
    ? Promise.all(repoIds.map(id => client.contentRepositories.get(id)))
    : paginator(hub.related.contentRepositories.list));

  for (let i = 0; i < repositories.length; i++) {
    const repository = repositories[i];

    // Add content items in repo base folder. Cache the other items so we don't have to request them again.
    let newItems: ContentItem[];
    try {
      const allItems = await paginator(repository.related.contentItems.list, { status: 'ACTIVE' });

      Array.prototype.push.apply(repoItems, allItems);
      newItems = allItems.filter(item => item.folderId == null);
    } catch (e) {
      log.warn(`Could not get items from repository ${repository.name} (${repository.id})`, e);
      continue;
    }

    Array.prototype.push.apply(items, newItems);
  }

  const parallelism = 10;
  const folders = await Promise.all(folderIds.map(id => client.folders.get(id)));
  log.appendLine(`Found ${folders.length} base folders.`);

  const nextFolders: Folder[] = [];
  let processFolders = folders;

  while (processFolders.length > 0) {
    const promises = processFolders.map(
      async (folder: Folder): Promise<void> => {
        let newItems: ContentItem[];
        // If we already have seen items in this folder, use those. Otherwise try get them explicitly.
        // This may happen for folders in selected repositories if they are empty, but it will be a no-op (and is unavoidable).
        newItems = repoItems.filter(item => item.folderId == folder.id);
        if (newItems.length == 0) {
          log.appendLine(`Fetching additional folder: ${folder.name}`);
          try {
            newItems = (await paginator(folder.related.contentItems.list)).filter(item => item.status === 'ACTIVE');
          } catch (e) {
            log.warn(`Could not get items from folder ${folder.name} (${folder.id})`, e);
            return;
          }
        }
        Array.prototype.push.apply(items, newItems);

        try {
          const subfolders = await paginator(folder.related.folders.list);
          Array.prototype.push.apply(nextFolders, subfolders);
        } catch (e) {
          log.warn(`Could not get subfolders from folder ${folder.name} (${folder.id})`, e);
        }
      }
    );

    await Promise.all(promises);

    processFolders = nextFolders.splice(0, Math.min(nextFolders.length, parallelism));
  }

  return items;
};

export const handler = async (argv: Arguments<PublishItemBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { repoId, logFile } = argv;

  const facet = withOldFilters(argv.facet, argv);

  const client = dynamicContentClientFactory(argv);
  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;
  const hub = await client.hubs.get(argv.hubId);

  log.appendLine('Retrieving content items, please wait.');
  let items = await getContentItems(client, hub, log, repoId);

  // Filter using the facet, if present.
  if (facet) {
    items = applyFacet(items, facet);
  }

  const augmentedDynamicContent = augmentedDynamicContentClientFactory(argv);
  const publishingHub = await augmentedDynamicContent.publishinghubs.get(argv.hubId);

  const snapshotList: PublishingSnapshotResultList = await publishingHub.related.snapshots.create(
    items.map(
      item =>
        new Snapshot({
          contentRoot: item.id,
          comment: '',
          createdFrom: PublishingSnapshotCreator.CONTENTITEM,
          type: SnapshotType.USER
        })
    )
  );

  snapshotList.snapshots.forEach(snapshot => {
    snapshot.related.publish(new Date());
  });

  await log.close();
};
