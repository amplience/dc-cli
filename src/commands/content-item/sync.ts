import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { withOldFilters } from '../../common/filter/facet';
import { Job, Status } from 'dc-management-sdk-js';
import { getContent } from '../../common/filter/fetch-content';
import { confirmAllContent } from '../../common/content-item/confirm-all-content';
import { progressBar } from '../../common/progress-bar/progress-bar';
import { ContentItemSyncService } from './sync.service';
import { dedupeContentItems } from '../../common/content-item/dedupe-content-items';
import { getContentByIds } from '../../common/content-item/get-content-items-by-ids';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('content-item', 'sync', platform);

export const coerceLog = (logFile: string): FileLog => createLog(logFile, 'Content Items Sync Log');

export const command = 'sync [id]';

export const desc = 'Sync Content Items';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe: `The ID of a content item to sync. If id is not provided, this command will sync ALL content items through all content repositories in the hub.`
    })
    .option('repoId', {
      type: 'string',
      describe: 'The ID of a content repository to search items in to be sync.',
      requiresArg: false
    })
    .option('folderId', {
      type: 'string',
      describe: 'The ID of a folder to search items in to be sync.',
      requiresArg: false
    })
    .option('facet', {
      type: 'string',
      describe:
        "Publish content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
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
    .option('destinationHubId', {
      type: 'string',
      describe: 'The ID of a destination hub to sync with.',
      requiresArg: true,
      demandOption: true
    });
};

export default interface SyncOptions {
  id?: string;
  repoId?: string | string[];
  folderId?: string | string[];
  facet?: string;
  logFile: FileLog;
  force?: boolean;
  silent?: boolean;
  destinationHubId: string;
}

export const handler = async (argv: Arguments<SyncOptions & ConfigurationParameters>): Promise<void> => {
  const { id, logFile, force, silent, hubId, repoId, folderId, destinationHubId } = argv;
  const log = logFile.open();
  const client = dynamicContentClientFactory(argv);

  const facet = withOldFilters(argv.facet, argv);

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

  const allContent = !id && !facet && !folderId && !repoId;
  if (allContent) {
    log.appendLine('No filter was given, syncing all content');
  }

  const hub = await client.hubs.get(hubId);

  let ids: string[] = [];

  if (id) {
    ids = Array.isArray(id) ? id : [id];
  }

  const contentItems =
    ids.length > 0
      ? await getContentByIds(client, ids)
      : await getContent(client, hub, facet, { repoId, folderId, status: Status.ACTIVE, enrichItems: true });

  if (!contentItems.length) {
    log.appendLine('Nothing found to sync, aborting');
    return;
  }

  const dedupedContentItems = dedupeContentItems(contentItems);

  log.appendLine(
    `Found ${dedupedContentItems.length} item(s) to sync (ignoring ${contentItems.length - dedupedContentItems.length} duplicate child item(s))`
  );

  const missingContentItems = ids.length > 0 ? Boolean(ids.length !== contentItems.length) : false;

  if (!force) {
    const yes = await confirmAllContent('sync', 'content items', allContent, missingContentItems);
    if (!yes) {
      return;
    }
  }

  log.appendLine(`Syncing ${dedupedContentItems.length} item(s)`);

  const progress = progressBar(dedupedContentItems.length, 0, { title: 'Syncing content items' });
  const syncService = new ContentItemSyncService();

  dedupedContentItems.forEach(contentItem => {
    log.addComment(`Requesting content item sync: ${contentItem.label}`);
    syncService.sync(destinationHubId, hub, contentItem, (syncJob: Job) => {
      progress.increment();
      const logComment =
        syncJob.status === 'FAILED'
          ? `Failed content item sync job ${syncJob.id}: ${JSON.stringify(syncJob.errors)}`
          : `Content item synced: ${contentItem.label} (jobId: ${syncJob.id})`;

      log.addComment(logComment);
    });
  });

  await syncService.onIdle();
  progress.stop();

  const failedJobCount = syncService.failedJobs.length;
  const failedJobsMsg = failedJobCount ? `with ${failedJobCount} failed jobs - check logs for details` : ``;

  log.appendLine(`Sync complete ${failedJobsMsg}`);

  await log.close(!silent);
};
