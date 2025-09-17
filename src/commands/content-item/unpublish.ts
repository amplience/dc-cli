/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { confirmAllContent } from '../../common/content-item/confirm-all-content';
import PublishOptions from '../../common/publish/publish-options';
import {
  ContentItem,
  ContentItemPublishingStatus,
  ContentRepository,
  DynamicContent,
  Status
} from 'dc-management-sdk-js';
import { getDefaultLogPath, createLog } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
import { withOldFilters } from '../../common/filter/facet';
import { getContent } from '../../common/filter/fetch-content';
import { ContentDependancyTree } from '../../common/content-item/content-dependancy-tree';
import { ContentMapping } from '../../common/content-mapping';
import { progressBar } from '../../common/progress-bar/progress-bar';
import { ContentItemUnpublishingService } from '../../common/publishing/content-item-unpublishing-service';

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
  missingContent
}: {
  contentItems: ContentItem[];
  force?: boolean;
  silent?: boolean;
  logFile: FileLog;
  allContent: boolean;
  missingContent: boolean;
}): Promise<void> => {
  if (contentItems.length == 0) {
    console.log('Nothing found to unpublish, aborting.');
    return;
  }

  const repoContentItems = contentItems.map(content => ({ repo: new ContentRepository(), content }));
  const contentTree = new ContentDependancyTree(repoContentItems, new ContentMapping());
  let unpublishChildren = 0;
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
        unpublishChildren++;
      }

      return isTopLevel;
    })
    .map(node => node.owner.content);

  const rootContentPublishedItems = rootContentItems.filter(
    item => item.publishingStatus !== ContentItemPublishingStatus.UNPUBLISHED
  );

  const log = logFile.open();
  log.appendLine(
    `Found ${rootContentPublishedItems.length} items to unpublish. (${unpublishChildren} children included)`
  );

  if (rootContentPublishedItems.length === 0) {
    return;
  }

  if (!force) {
    const yes = await confirmAllContent('unpublish', 'content items', allContent, missingContent);
    if (!yes) {
      return;
    }
  }

  log.appendLine(`Unpublishing ${rootContentPublishedItems.length} items.`);

  const unpublishingService = new ContentItemUnpublishingService();
  const contentItemUnpublishJobs: ContentItem[] = [];
  const unpublishProgress = progressBar(rootContentPublishedItems.length, 0, { title: 'Unpublishing content items' });

  for (const item of rootContentPublishedItems) {
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

  log.appendLine(`The request for content item/s to be unpublished has been completed - please manually verify.`);

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
    console.log('No filter was given, unpublishing all content');
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
    missingContent
  });
};
