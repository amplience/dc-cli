import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { confirmAllContent } from '../../common/content-item/confirm-all-content';
import PublishOptions from '../../common/publish/publish-options';
import { ContentItem, ContentItemPublishingStatus, Status } from 'dc-management-sdk-js';
import { getDefaultLogPath, createLog } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
import { withOldFilters } from '../../common/filter/facet';
import { getContent } from '../../common/filter/fetch-content';
import { progressBar } from '../../common/progress-bar/progress-bar';
import { ContentItemUnpublishingService } from '../../common/publishing/content-item-unpublishing-service';
import { getContentByIds } from '../../common/content-item/get-content-items-by-ids';

export const command = 'unpublish [id]';

export const desc = 'Unublish Content Items';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('content-item', 'unpublish', platform);

export const coerceLog = (logFile: string): FileLog => createLog(logFile, 'Content Items Unpublish Log');

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe:
        'The ID of a content item to be unpublished. If id is not provided, this command will unpublish ALL content items through all content repositories in the hub.'
    })
    .option('repoId', {
      type: 'string',
      describe: 'The ID of a content repository to search items in to be unpublished.',
      requiresArg: false
    })
    .option('folderId', {
      type: 'string',
      describe: 'The ID of a folder to search items in to be unpublished.',
      requiresArg: false
    })
    .option('facet', {
      type: 'string',
      describe:
        "Unpublish content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, there will be no confirmation prompt before unpublishing the found content.'
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

export const processItems = async ({
  contentItems,
  log
}: {
  contentItems: ContentItem[];
  log: FileLog;
}): Promise<void> => {
  log.appendLine(`Unpublishing ${contentItems.length} items.`);

  const unpublishingService = new ContentItemUnpublishingService();
  const contentItemUnpublishJobs: ContentItem[] = [];
  const unpublishProgress = progressBar(contentItems.length, 0, { title: 'Unpublishing content items' });

  for (const item of contentItems) {
    try {
      await unpublishingService.unpublish(item, contentItem => {
        contentItemUnpublishJobs.push(contentItem);

        log.addComment(`Initiated unpublish for "${item.label}"`);
        unpublishProgress.increment();
      });
    } catch (e) {
      log.appendLine(`\nFailed to initiate unpublish for ${item.label}: ${e.toString()}`);
      unpublishProgress.increment();
    }
  }

  await unpublishingService.onIdle();
  unpublishProgress.stop();
};

export const handler = async (argv: Arguments<PublishOptions & ConfigurationParameters>): Promise<void> => {
  const { id, logFile, force, silent, hubId, repoId, folderId } = argv;
  const log = logFile.open();
  const client = dynamicContentClientFactory(argv);
  const facet = withOldFilters(argv.facet, argv);
  const allContent = !id && !facet && !folderId && !repoId;

  if (repoId && id) {
    log.appendLine('ID of content item is specified, ignoring repository ID');
  }

  if (id && facet) {
    log.appendLine('Please specify either a facet or an ID - not both');
    return;
  }

  if (repoId && folderId) {
    log.appendLine('Folder is specified, ignoring repository ID');
  }

  if (allContent) {
    log.appendLine('No filter was given, unpublishing all content');
  }

  let ids: string[] = [];

  if (id) {
    ids = Array.isArray(id) ? id : [id];
  }

  const hub = await client.hubs.get(hubId);
  const contentItems =
    ids.length > 0
      ? await getContentByIds(client, ids)
      : await getContent(client, hub, facet, { repoId, folderId, status: Status.ACTIVE, enrichItems: true });

  const unpublishableContentItems = contentItems.filter(
    item =>
      item.publishingStatus !== ContentItemPublishingStatus.UNPUBLISHED &&
      item.publishingStatus !== ContentItemPublishingStatus.NONE
  );

  if (!unpublishableContentItems.length) {
    log.appendLine('Nothing found to unpublish, aborting');
    return;
  }

  const missingContentItems = ids.length > 0 ? Boolean(ids.length !== unpublishableContentItems.length) : false;

  log.appendLine(`Found ${unpublishableContentItems.length} content items to unpublish\n`);

  if (!force) {
    const yes = await confirmAllContent('unpublish', 'content items', allContent, missingContentItems);
    if (!yes) {
      return;
    }
  }

  await processItems({
    contentItems: unpublishableContentItems,
    log
  });

  log.appendLine(`Unpublish complete - please manually verify unpublish status`);

  await log.close(!silent);
};
