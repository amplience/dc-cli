import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import { confirmAllContent } from '../../common/content-item/confirm-all-content';
import ArchiveOptions from '../../common/archive/archive-options';
import { ContentItem, Status } from 'dc-management-sdk-js';
import { getDefaultLogPath, createLog } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
import { withOldFilters } from '../../common/filter/facet';
import { getContent } from '../../common/filter/fetch-content';
import { progressBar } from '../../common/progress-bar/progress-bar';
import { getContentByIds } from '../../common/content-item/get-content-items-by-ids';

export const command = 'archive [id]';

export const desc = 'Archive Content Items';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('content-item', 'archive', platform);

export const coerceLog = (logFile: string): FileLog => createLog(logFile, 'Content Items Archive Log');

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe:
        'The ID of a content item to be archived. If id is not provided, this command will archive ALL content items through all content repositories in the hub.'
    })
    .option('repoId', {
      type: 'string',
      describe: 'The ID of a content repository to search items in to be archived.',
      requiresArg: false
    })
    .option('folderId', {
      type: 'string',
      describe: 'The ID of a folder to search items in to be archived.',
      requiresArg: false
    })
    .option('facet', {
      type: 'string',
      describe:
        "Archive content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
    })
    .option('revertLog', {
      type: 'string',
      describe:
        'Path to a log file containing content items unarchived in a previous run of the unarchive command.\nWhen provided, archives all content items listed as UNARCHIVE in the log file.',
      requiresArg: false
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, there will be no confirmation prompt before archiving the found content.'
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
      describe: 'If present, archive requests that fail will not abort the process.'
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
      describe: 'Ignore content item schema validation during archive'
    });
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
}): Promise<{ failedArchives: ContentItem[] }> => {
  const progress = progressBar(contentItems.length, 0, { title: 'Archiving content items' });
  const failedArchives = [];

  for (let i = 0; i < contentItems.length; i++) {
    try {
      const deliveryKey = contentItems[i].body._meta.deliveryKey;
      const deliveryKeys = (contentItems[i].body._meta.deliveryKeys?.values || []).map(
        (key: { value: string }) => key.value
      );
      let args = contentItems[i].id;
      if (deliveryKey || deliveryKeys.length) {
        contentItems[i].body._meta.deliveryKey = null;
        contentItems[i].body._meta.deliveryKeys = null;
        const updateParams = { ...(ignoreSchemaValidation ? { ignoreSchemaValidation: true } : {}) };
        contentItems[i] = await contentItems[i].related.update(contentItems[i], updateParams);

        args += ` ${deliveryKey || ''} ${deliveryKeys.join(',')}`;
      }
      await contentItems[i].related.archive();
      progress.increment();
      log.addAction('ARCHIVE', `${args}`);
    } catch (e) {
      failedArchives.push(contentItems[i]);
      progress.increment();
      log.addComment(`ARCHIVE FAILED: ${contentItems[i].id}`);
      log.addComment(e.toString());

      if (ignoreError) {
        log.warn(`\nFailed to archive ${contentItems[i].label} (${contentItems[i].id}), continuing.`, e);
      } else {
        progress.stop();
        log.error(`\nFailed to archive ${contentItems[i].label} (${contentItems[i].id}), aborting.`, e);
        break;
      }
    }
  }

  progress.stop();

  return { failedArchives };
};

export const handler = async (argv: Arguments<ArchiveOptions & ConfigurationParameters>): Promise<void> => {
  const { id, logFile, force, silent, ignoreError, hubId, revertLog, repoId, folderId, ignoreSchemaValidation } = argv;
  const log = logFile.open();
  const client = dynamicContentClientFactory(argv);
  const facet = withOldFilters(argv.facet, argv);
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

  if (id) {
    ids = Array.isArray(id) ? id : [id];
  }

  if (revertLog) {
    const log = await new ArchiveLog().loadFromFile(revertLog);
    ids = log.getData('UNARCHIVE');
  }

  const hub = await client.hubs.get(hubId);
  const contentItems = ids.length
    ? (await getContentByIds(client, ids)).filter(item => item.status === Status.ACTIVE)
    : await getContent(client, hub, facet, { repoId, folderId, status: Status.ACTIVE, enrichItems: true });

  if (!contentItems.length) {
    log.appendLine('Nothing found to archive, aborting');
    return;
  }

  const missingContentItems = ids.length > 0 ? Boolean(ids.length !== contentItems.length) : false;
  log.appendLine(`Found ${contentItems.length} content items to archive`);

  if (!force) {
    const yes = await confirmAllContent('archive', 'content item', allContent, missingContentItems);
    if (!yes) {
      return;
    }
  }

  const { failedArchives } = await processItems({
    contentItems,
    log,
    ignoreError,
    ignoreSchemaValidation
  });

  const failedArchiveMsg = failedArchives.length
    ? `with ${failedArchives.length} failed archives - check logs for details`
    : ``;

  log.appendLine(`Archived content items ${failedArchiveMsg}`);

  await log.close(!silent);
};

// log format:
// ARCHIVE <content item id>
