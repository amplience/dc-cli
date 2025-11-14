import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import { confirmAllContent } from '../../common/content-item/confirm-all-content';
import { ContentItem, DynamicContent, Status } from 'dc-management-sdk-js';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { Facet, withOldFilters } from '../../common/filter/facet';
import { getContent } from '../../common/filter/fetch-content';
import { isEqual } from 'lodash';
import { getContentByIds } from '../../common/content-item/get-content-items-by-ids';
import { FileLog } from '../../common/file-log';
import { progressBar } from '../../common/progress-bar/progress-bar';
import ContentItemUnarchiveOptions from '../../common/archive/content-item-unarchive-options';

export const command = 'unarchive [id]';

export const desc = 'Unarchive Content Items';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('content-item', 'unarchive', platform);

export const coerceLog = (logFile: string): FileLog => createLog(logFile, 'Content Items Unarchive Log');

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe:
        'The ID of a content item to be unarchived. If id is not provided, this command will unarchive ALL content items through all content repositories in the hub.'
    })
    .option('repoId', {
      type: 'string',
      describe: 'The ID of a content repository to search items in to be unarchived.',
      requiresArg: false
    })
    .option('folderId', {
      type: 'string',
      describe: 'The ID of a folder to search items in to be unarchived.',
      requiresArg: false
    })
    .option('facet', {
      type: 'string',
      describe:
        "Unarchive content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
    })
    .option('revertLog', {
      type: 'string',
      describe:
        'Path to a log file containing content items archived in a previous run of the archive command.\nWhen provided, archives all content items listed as ARCHIVE in the log file.',
      requiresArg: false
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, there will be no confirmation prompt before unarchiving the found content.'
    })
    .alias('s', 'silent')
    .option('s', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, no log file will be produced.'
    })
    .option('ignoreError', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, unarchive requests that fail will not abort the process.'
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
    })
    .option('schemaId', {
      type: 'string',
      hidden: true
    })
    .option('ignoreSchemaValidation', {
      type: 'boolean',
      boolean: false,
      describe: 'Ignore content item schema validation during unarchive'
    });
};

const getContentToUnarchiveWithIds = async ({
  client,
  ids,
  revertItems
}: {
  client: DynamicContent;
  ids: string[];
  revertItems?: string[][];
}) => {
  let contentItemIds = ids;

  if (revertItems?.length) {
    contentItemIds = revertItems.map(item => item[0]);
  }

  const contentItems = await getContentByIds(client, contentItemIds);
  const contentItemsWithRevert = contentItems.map(item => {
    const revertItem = revertItems?.find(revertItem => item.id === revertItem[0]);
    if (revertItem) {
      const [, key, keys] = revertItem;
      const deliveryKeys = keys?.split(',') || [];
      item.body._meta.deliveryKey = key || null;
      if (keys?.length) {
        item.body._meta.deliveryKeys = {
          values: deliveryKeys.map(k => ({ value: k }))
        };
      }
    }
    return item;
  });

  return contentItemsWithRevert.filter(item => item.status === Status.ARCHIVED);
};

const getContentToUnarchiveWithFacet = async ({
  client,
  hubId,
  facet,
  repoId,
  folderId
}: {
  client: DynamicContent;
  hubId: string;
  facet?: Facet | string | undefined;
  repoId?: string | string[];
  folderId?: string | string[];
}) => {
  const hub = await client.hubs.get(hubId);
  const contentItems = await getContent(client, hub, facet, { repoId, folderId, status: Status.ARCHIVED });

  // Delete the delivery keys, as the unarchive will attempt to reassign them if present.
  contentItems.forEach(item => {
    delete item.body._meta.deliveryKey;
    delete item.body._meta.deliveryKeys;
  });

  return contentItems;
};

const processItems = async ({
  contentItems,
  log,
  ignoreError,
  ignoreSchemaValidation
}: {
  contentItems: ContentItem[];
  log: FileLog;
  ignoreError?: boolean;
  ignoreSchemaValidation?: boolean;
}): Promise<{ failedUnarchives: ContentItem[] }> => {
  const progress = progressBar(contentItems.length, 0, { title: 'Unarchiving content items' });
  const failedUnarchives: ContentItem[] = [];

  for (let i = 0; i < contentItems.length; i++) {
    try {
      const deliveryKey = contentItems[i].body._meta.deliveryKey;
      const deliveryKeys = contentItems[i].body._meta.deliveryKeys;
      contentItems[i] = await contentItems[i].related.unarchive();

      if (
        contentItems[i].body._meta.deliveryKey !== deliveryKey ||
        !isEqual(contentItems[i].body._meta.deliveryKeys, deliveryKeys)
      ) {
        // Restore the delivery key if present. (only on ARCHIVE revert)
        contentItems[i].body._meta.deliveryKey = deliveryKey || null;
        contentItems[i].body._meta.deliveryKeys = deliveryKeys;
        const updateParams = { ...(ignoreSchemaValidation ? { ignoreSchemaValidation: true } : {}) };
        await contentItems[i].related.update(contentItems[i], updateParams);
      }

      log.addAction('UNARCHIVE', `${contentItems[i].id}\n`);
      progress.increment();
    } catch (e) {
      failedUnarchives.push(contentItems[i]);
      progress.increment();
      log.addComment(`UNARCHIVE FAILED: ${contentItems[i].id}`);
      log.addComment(e.toString());

      if (ignoreError) {
        log.warn(`Failed to unarchive ${contentItems[i].label} (${contentItems[i].id}), continuing.`, e);
      } else {
        progress.stop();
        log.error(`Failed to unarchive ${contentItems[i].label} (${contentItems[i].id}), aborting.`, e);
        break;
      }
    }
  }

  progress.stop();

  return { failedUnarchives };
};

export const handler = async (
  argv: Arguments<ContentItemUnarchiveOptions & ConfigurationParameters>
): Promise<void> => {
  const { id, logFile, force, silent, ignoreError, hubId, revertLog, repoId, folderId, ignoreSchemaValidation } = argv;
  const log = logFile.open();
  const facet = withOldFilters(argv.facet, argv);
  const client = dynamicContentClientFactory(argv);
  const allContent = !id && !facet && !revertLog && !folderId && !repoId;

  if (repoId && id) {
    log.appendLine('ID of content item is specified, ignoring repository ID');
  }

  if (id && facet) {
    log.appendLine('Please specify either a facet or an ID - not both.');
    return;
  }

  if (repoId && folderId) {
    log.appendLine('Folder is specified, ignoring repository ID');
  }

  if (allContent) {
    log.appendLine('No filter was given, archiving all content');
  }

  let ids: string[] = [];
  let revertItems: string[][] = [];

  if (id) {
    ids = Array.isArray(id) ? id : [id];
  }

  if (revertLog) {
    const log = await new ArchiveLog().loadFromFile(revertLog);
    revertItems = log.getData('ARCHIVE').map(args => args.split(' '));
    ids = revertItems.map(item => item[0]);
  }

  const contentItems = ids.length
    ? await getContentToUnarchiveWithIds({ client, ids, revertItems })
    : await getContentToUnarchiveWithFacet({ client, hubId, facet, repoId, folderId });

  if (!contentItems.length) {
    log.appendLine('Nothing found to unarchive, aborting');
    return;
  }

  const missingContentItems = ids.length > 0 ? Boolean(ids.length !== contentItems.length) : false;
  logFile.appendLine(`Found ${contentItems.length} content items to unarchive`);

  if (!force) {
    const yes = await confirmAllContent('unarchive', 'content item', allContent, missingContentItems);
    if (!yes) {
      return;
    }
  }

  const { failedUnarchives } = await processItems({
    contentItems,
    log,
    ignoreError,
    ignoreSchemaValidation
  });

  const failedUnarchiveMsg = failedUnarchives.length
    ? `with ${failedUnarchives.length} failed archives - check logs for details`
    : ``;

  log.appendLine(`Unarchived content items ${failedUnarchiveMsg}`);

  await log.close(!silent);
};

// log format:
// UNARCHIVE <content item id>
