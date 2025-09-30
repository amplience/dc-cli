/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { confirmAllContent } from '../../common/content-item/confirm-all-content';
import PublishOptions from '../../common/publish/publish-options';
import { ContentItem, ContentRepository, DynamicContent, PublishingJob, Status } from 'dc-management-sdk-js';
import { getDefaultLogPath, createLog } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
import { withOldFilters } from '../../common/filter/facet';
import { getContent } from '../../common/filter/fetch-content';
import { asyncQuestion } from '../../common/question-helpers';
import { ContentDependancyTree } from '../../common/content-item/content-dependancy-tree';
import { ContentMapping } from '../../common/content-mapping';
import { ContentItemPublishingService } from '../../common/publishing/content-item-publishing-service';
import { ContentItemPublishingJobService } from '../../common/publishing/content-item-publishing-job-service';
import { PublishingJobStatus } from 'dc-management-sdk-js/build/main/lib/model/PublishingJobStatus';
import { progressBar } from '../../common/progress-bar/progress-bar';

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
  client,
  contentItems,
  force,
  silent,
  logFile,
  allContent,
  missingContent
}: {
  client: DynamicContent;
  contentItems: ContentItem[];
  force?: boolean;
  silent?: boolean;
  logFile: FileLog;
  allContent: boolean;
  missingContent: boolean;
}): Promise<void> => {
  if (contentItems.length == 0) {
    console.log('Nothing found to publish, aborting.');
    return;
  }

  const repoContentItems = contentItems.map(content => ({ repo: new ContentRepository(), content }));
  const contentTree = new ContentDependancyTree(repoContentItems, new ContentMapping());

  let publishChildren = 0;

  const rootContentItems = contentTree.all.map(node => {
    publishChildren += node?.dependancies?.length || 0;

    return node.owner.content;
  });

  const log = logFile.open();
  log.appendLine(
    `Found ${rootContentItems.length} ${rootContentItems.length > 1 ? 'items' : 'item'} to publish. (${publishChildren} ${publishChildren > 1 ? 'children' : 'child'} included)`
  );

  if (!force) {
    const yes = await confirmAllContent('publish', 'content items', allContent, missingContent);
    if (!yes) {
      return;
    }
  }

  log.appendLine(`Publishing ${rootContentItems.length} item/s ${publishChildren > 0 && '(including any children)'}.`);

  const publishingService = new ContentItemPublishingService();
  const contentItemPublishJobs: [ContentItem, PublishingJob][] = [];
  const publishProgress = progressBar(rootContentItems.length, 0, { title: 'Publishing content items' });

  for (const item of rootContentItems) {
    try {
      await publishingService.publish(item, (contentItem, publishingJob) => {
        contentItemPublishJobs.push([contentItem, publishingJob]);
        log.addComment(`Initiated publish for "${item.label}"`);
        publishProgress.increment();
      });
    } catch (e) {
      log.appendLine(`\nFailed to initiate publish for ${item.label}: ${e.toString()}`);
      publishProgress.increment();
    }
  }

  await publishingService.onIdle();
  publishProgress.stop();

  const checkPublishJobs = async () =>
    await asyncQuestion(
      'All publishes have been requested, would you like to wait for all publishes to complete? (y/n)'
    );

  if (force || (await checkPublishJobs())) {
    log.appendLine(`Checking publishing state for ${contentItemPublishJobs.length} items.`);
    const checkPublishProgress = progressBar(contentItemPublishJobs.length, 0, {
      title: 'Content items publishes complete'
    });

    const publishingJobService = new ContentItemPublishingJobService(client);

    for (const [contentItem, publishingJob] of contentItemPublishJobs) {
      publishingJobService.check(publishingJob, async resolvedPublishingJob => {
        log.addComment(`Finished checking publish job for ${contentItem.label}`);
        if (resolvedPublishingJob.state === PublishingJobStatus.FAILED) {
          log.appendLine(`\nFailed to publish ${contentItem.label}: ${resolvedPublishingJob.publishErrorStatus}`);
        }
        checkPublishProgress.increment();
      });
    }

    await publishingJobService.onIdle();
    checkPublishProgress.stop();
  }

  log.appendLine(`Publishing complete`);

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
    client,
    contentItems,
    force,
    silent,
    logFile,
    allContent,
    missingContent
  });
};
