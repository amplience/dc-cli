import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { withOldFilters } from '../../common/filter/facet';
import { ContentItem, ContentRepository, DynamicContent, Hub, Job, Status } from 'dc-management-sdk-js';
import { getContent } from '../../common/filter/fetch-content';
import { ContentMapping } from '../../common/content-mapping';
import { ContentDependancyTree } from '../../common/content-item/content-dependancy-tree';
import { confirmAllContent } from '../../common/content-item/confirm-all-content';
import { progressBar } from '../../common/progress-bar/progress-bar';
import { ContentItemSyncService } from './sync.service';

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

export const fetchContentByIds = async (client: DynamicContent, ids: string[]) => {
  const contentItems: ContentItem[] = [];

  for (const id of ids) {
    try {
      contentItems.push(await client.contentItems.get(id));
    } catch (e) {
      throw new Error(`Missing content item with id: ${id}: ${e.message} `);
    }
  }

  return contentItems.filter(item => item.status === Status.ACTIVE);
};

export const listContent = async (
  client: DynamicContent,
  hub: Hub,
  {
    repoId,
    folderId,
    facet,
    status
  }: { repoId?: string | string[]; folderId?: string | string[]; facet?: string; status?: Status }
) => {
  return await getContent(client, hub, facet, { repoId, folderId, status: status || Status.ACTIVE, enrichItems: true });
};

export const getRootContentItems = (contentItems: ContentItem[]) => {
  const repoContentItems = contentItems.map(content => ({ repo: new ContentRepository(), content }));
  const contentTree = new ContentDependancyTree(repoContentItems, new ContentMapping());
  const rootContentItems = contentTree.all
    .filter(node => {
      let isTopLevel = true;

      contentTree.traverseDependants(
        node,
        dependant => {
          if (dependant != node && contentTree.all.findIndex(entry => entry === dependant) !== -1) {
            isTopLevel = false;
          }
        },
        true
      );

      return isTopLevel;
    })
    .map(node => node.owner.content);

  return rootContentItems;
};

export default interface SyncOptions {
  id?: string | string[];
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
  const client = dynamicContentClientFactory(argv);

  const facet = withOldFilters(argv.facet, argv);

  if (repoId && id) {
    console.log('ID of content item is specified, ignoring repository ID');
  }

  if (id && facet) {
    console.log('Please specify either a facet or an ID - not both');
    return;
  }

  if (repoId && folderId) {
    console.log('Folder is specified, ignoring repository ID');
  }

  const allContent = !id && !facet && !folderId && !repoId;
  if (allContent) {
    console.log('No filter was given, syncing all content');
  }

  const hub = await client.hubs.get(hubId);

  const contentItems = id
    ? await fetchContentByIds(client, Array.isArray(id) ? id : [id])
    : await listContent(client, hub, { repoId, folderId, facet });

  if (!contentItems.length) {
    console.log('Nothing found to sync, aborting');
  }

  const rootContentItems = getRootContentItems(contentItems);
  const log = logFile.open();

  log.appendLine(
    `Found ${rootContentItems.length} item(s) to sync (ignoring ${contentItems.length - rootContentItems.length} duplicate child item(s))`
  );

  if (!force) {
    const yes = await confirmAllContent('sync', 'content items', allContent, false);
    if (!yes) {
      return;
    }
  }

  log.appendLine(`Syncing ${rootContentItems.length} item(s)`);

  const syncProgress = progressBar(rootContentItems.length, 0, { title: 'Syncing content items' });
  const syncService = new ContentItemSyncService();

  rootContentItems.forEach(contentItem => {
    log.addComment(`Requesting content item sync: ${contentItem.label}`);
    syncService.sync(destinationHubId, hub, contentItem, (syncJob: Job) => {
      syncProgress.increment();
      if (syncJob.status === 'FAILED') {
        log.addComment(`Failed content item sync job ${syncJob.id}: ${JSON.stringify(syncJob.errors)}`);
        return;
      }
      log.addComment(`Content item synced: ${contentItem.label} (jobId: ${syncJob.id}) ${JSON.stringify(syncJob)}`);
    });
  });

  await syncService.onIdle();
  syncProgress.stop();

  const failedJobsMsg = syncService.failedJobs.length
    ? `with ${syncService.failedJobs.length} failed jobs - check logs for details`
    : ``;

  log.appendLine(`Sync complete ${failedJobsMsg}`);

  await log.close(!silent);
};
