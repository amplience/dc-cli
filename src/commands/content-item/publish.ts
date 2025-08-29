/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { confirmAllContent } from '../../common/content-item/confirm-all-content';
import PublishOptions from '../../common/publish/publish-options';
import { ContentItem, ContentRepository, DynamicContent, Status } from 'dc-management-sdk-js';
import { getDefaultLogPath, createLog } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
import { withOldFilters } from '../../common/filter/facet';
import { getContent } from '../../common/filter/fetch-content';
import { MAX_PUBLISH_RATE_LIMIT } from '../../common/import/publish-queue';
import { asyncQuestion } from '../../common/question-helpers';
import { ContentDependancyTree } from '../../common/content-item/content-dependancy-tree';
import { ContentMapping } from '../../common/content-mapping';
import { PublishingService } from '../../common/publishing/publishing-service';
import { PublishingJobService } from '../../common/publishing/publishing-job-service';

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
    .options('publishRateLimit', {
      type: 'number',
      describe: `Set the number of publishes per minute (max = ${MAX_PUBLISH_RATE_LIMIT})`
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

  const repoContentItems = contentItems.map(content => ({ repo: new ContentRepository(), content }));
  const contentTree = new ContentDependancyTree(repoContentItems, new ContentMapping());
  let publishChildren = 0;
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

      if (!isTopLevel) {
        publishChildren++;
      }

      return isTopLevel;
    })
    .map(node => node.owner.content);

  const log = logFile.open();
  log.appendLine(`Found ${rootContentItems.length} items to publish. (${publishChildren} children included)`);

  if (!force) {
    const yes = await confirmAllContent('publish', 'content items', allContent, missingContent);
    if (!yes) {
      return;
    }
  }

  log.appendLine(`Publishing ${rootContentItems.length} items.`);

  // if (!argv.batchPublish) {
  //   pubQueue.maxWaiting = 1;
  // }

  const publishingService = new PublishingService();

  for (const item of rootContentItems) {
    try {
      await publishingService.publish(item, () => {
        log.appendLine(`Initiating publish for "${item.label}"`);
      });
    } catch (e) {
      log.appendLine(`Failed to initiate publish for ${item.label}: ${e.toString()}`);
    }
  }

  log.appendLine(`Waiting for all publish jobs to complete...`);

  const client = dynamicContentClientFactory(argv);
  const publishingJobService = new PublishingJobService(client);

  for (const publishJob of publishingService.publishJobs) {
    publishingJobService.check(publishJob, async () => {
      log.appendLine(`trying to retry publish ${publishJob.label}`);
    });
  }

  let keepWaiting = true;
  while (publishingJobService.size > 0 && keepWaiting) {
    if (publishingJobService.pendingSize > 0) {
      keepWaiting = await asyncQuestion(
        'Some publishes are taking longer than expected, would you like to continue waiting? (Y/n)'
      );
    }
  }

  log.appendLine(`Finished publishing, with ${publishingJobService.pendingSize} unresolved publish jobs`);
  publishingJobService.pendingPublishingContentItems.forEach(item => {
    log.appendLine(` - ${item.label}`);
  });

  log.appendLine(`Finished publishing, with ${publishingJobService.failedJobs.length} failed publish jobs`);
  publishingJobService.failedPublishingContentItems.forEach(item => {
    log.appendLine(` - ${item.label}`);
  });

  log.appendLine(`Publish complete`);

  await log.close(!silent);
};

export const handler = async (argv: Arguments<PublishOptions & ConfigurationParameters>): Promise<void> => {
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
