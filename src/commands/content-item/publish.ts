import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { confirmArchive } from '../../common/archive/archive-helpers';
import ArchiveOptions from '../../common/archive/archive-options';
import { ContentItem, DynamicContent, Status } from 'dc-management-sdk-js';
import { getDefaultLogPath, createLog } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
import { withOldFilters } from '../../common/filter/facet';
import { getContent } from '../../common/filter/fetch-content';
import { PublishQueue } from '../../common/import/publish-queue';

export const command = 'publish [id]';

export const desc = 'Publish Content Items';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('content-item', 'publish', platform);

export const coerceLog = (logFile: string): FileLog => createLog(logFile, 'Content Items Publish Log');

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe:
        'The ID of a content item to be published. If id is not provided, this command will publish ALL content items through all content repositories in the hub.'
    })
    .option('repoId', {
      type: 'string',
      describe: 'The ID of a content repository to search items in to be published.',
      requiresArg: false
    })
    .option('folderId', {
      type: 'string',
      describe: 'The ID of a folder to search items in to be published.',
      requiresArg: false
    })
    .option('facet', {
      type: 'string',
      describe:
        "Publish content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
    })
    .option('batchPublish', {
      type: 'boolean',
      boolean: true,
      describe: 'Batch publish requests up to the rate limit. (35/min)'
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, there will be no confirmation prompt before publishing the found content.'
    })
    .alias('s', 'silent')
    .option('s', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, no log file will be produced.'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: coerceLog
    })
    .option('name', {
      type: 'string',
      hidden: true
    });
};

export const getContentItems = async ({
  client,
  id,
  hubId,
  repoId,
  folderId,

  facet
}: {
  client: DynamicContent;
  id?: string | string[];
  hubId: string;
  repoId?: string | string[];
  folderId?: string | string[];

  facet?: string;
}): Promise<{ contentItems: ContentItem[]; missingContent: boolean }> => {
  try {
    let contentItems: ContentItem[] = [];

    if (id != null) {
      const itemIds = Array.isArray(id) ? id : [id];
      const items: ContentItem[] = [];

      for (const id of itemIds) {
        try {
          items.push(await client.contentItems.get(id));
        } catch {
          // Missing item.
        }
      }

      contentItems.push(...items.filter(item => item.status === Status.ACTIVE));

      return {
        contentItems,
        missingContent: contentItems.length != itemIds.length
      };
    }

    const hub = await client.hubs.get(hubId);

    contentItems = await getContent(client, hub, facet, { repoId, folderId, status: Status.ACTIVE, enrichItems: true });

    return { contentItems, missingContent: false };
  } catch (err) {
    console.log(err);

    return {
      contentItems: [],
      missingContent: false
    };
  }
};

export const processItems = async ({
  contentItems,
  force,
  silent,
  logFile,
  allContent,
  missingContent,
  argv
}: {
  contentItems: ContentItem[];
  force?: boolean;
  silent?: boolean;
  logFile: FileLog;
  allContent: boolean;
  missingContent: boolean;
  argv: Arguments<ConfigurationParameters>;
}): Promise<void> => {
  if (contentItems.length == 0) {
    console.log('Nothing found to publish, aborting.');
    return;
  }

  console.log('The following content items will be published:');
  contentItems.forEach((contentItem: ContentItem) => {
    console.log(` ${contentItem.label} (${contentItem.id})`);
  });
  console.log(`Total: ${contentItems.length}`);

  if (!force) {
    const yes = await confirmArchive('publish', 'content item', allContent, missingContent);
    if (!yes) {
      return;
    }
  }

  const log = logFile.open();

  let successCount = 0;

  const pubQueue = new PublishQueue(argv);

  log.appendLine(`Publishing ${contentItems.length} items.`);

  if (!argv.batchPublish) {
    pubQueue.maxWaiting = 1;
  }

  for (let i = 0; i < contentItems.length; i++) {
    const item = contentItems[i];

    try {
      await pubQueue.publish(item);
      log.appendLine(`Started publish for ${item.label}.`);
      successCount++;
    } catch (e) {
      log.appendLine(`Failed to initiate publish for ${item.label}: ${e.toString()}`);
    }
  }

  log.appendLine(`Waiting for all publishes to complete...`);
  await pubQueue.waitForAll();

  log.appendLine(`Finished publishing, with ${pubQueue.failedJobs.length} failed publishes total.`);
  pubQueue.failedJobs.forEach(job => {
    log.appendLine(` - ${job.item.label}`);
  });

  await log.close(!silent);

  console.log(`Published ${successCount} content items.`);
};

export const handler = async (argv: Arguments<ArchiveOptions & ConfigurationParameters>): Promise<void> => {
  const { id, logFile, force, silent, hubId, repoId, folderId } = argv;
  const client = dynamicContentClientFactory(argv);

  const facet = withOldFilters(argv.facet, argv);

  const allContent = !id && !facet && !folderId && !repoId;

  if (repoId && id) {
    console.log('ID of content item is specified, ignoring repository ID');
  }

  if (id && facet) {
    console.log('Please specify either a facet or an ID - not both.');
    return;
  }

  if (repoId && folderId) {
    console.log('Folder is specified, ignoring repository ID');
  }

  if (allContent) {
    console.log('No filter was given, publishing all content');
  }

  const { contentItems, missingContent } = await getContentItems({
    client,
    id,
    hubId,
    repoId,
    folderId,
    facet
  });

  await processItems({
    contentItems,
    force,
    silent,
    logFile,
    allContent,
    missingContent,
    argv
  });
};
