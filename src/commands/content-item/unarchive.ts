import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { confirmArchive } from '../../common/archive/archive-helpers';
import UnarchiveOptions from '../../common/archive/unarchive-options';
import { ContentItem, DynamicContent, Status } from 'dc-management-sdk-js';
import { getDefaultLogPath } from '../../common/log-helpers';
import { applyFacet, withOldFilters } from '../../common/filter/facet';

export const command = 'unarchive [id]';

export const desc = 'Unarchive Content Items';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('content-item', 'unarchive', platform);

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

export const filterContentItems = async ({
  revertLog,
  facet,
  contentItems
}: {
  revertLog?: string;
  facet?: string;
  contentItems: ContentItem[];
}): Promise<{ contentItems: ContentItem[]; missingContent: boolean } | undefined> => {
  try {
    let missingContent = false;

    if (revertLog != null) {
      const log = await new ArchiveLog().loadFromFile(revertLog);
      const archived = log.getData('ARCHIVE');
      const items = archived.map(args => args.split(' '));

      // The archive actions may include delivery keys that were removed.
      // Add these back to the content item, which will cause the unarchive to assign them later.
      const contentItemsFiltered = contentItems
        .map(contentItem => {
          const entry = items.find(item => item[0] === contentItem.id || '');
          if (entry) {
            contentItem.body._meta.deliveryKey = entry[1];
            return contentItem;
          } else {
            return null;
          }
        })
        .filter(contentItem => !!contentItem);

      missingContent = contentItems.length !== archived.length;

      return {
        contentItems: contentItemsFiltered as ContentItem[],
        missingContent
      };
    }

    // Delete the delivery keys, as the unarchive will attempt to reassign them if present.
    contentItems.forEach(item => delete item.body._meta.deliveryKey);

    if (facet != null) {
      const contentItemsFiltered = applyFacet(contentItems, facet);

      return {
        contentItems: contentItemsFiltered,
        missingContent
      };
    }

    return {
      contentItems,
      missingContent
    };
  } catch (err) {
    console.log(err);
    return {
      contentItems: [],
      missingContent: false
    };
  }
};

export const getContentItems = async ({
  client,
  id,
  hubId,
  repoId,
  folderId,
  revertLog,
  facet
}: {
  client: DynamicContent;
  id?: string;
  hubId: string;
  repoId?: string | string[];
  folderId?: string | string[];
  revertLog?: string;
  facet?: string;
}): Promise<{ contentItems: ContentItem[]; missingContent: boolean }> => {
  try {
    const contentItems: ContentItem[] = [];

    if (id != null) {
      contentItems.push(await client.contentItems.get(id));

      return {
        contentItems,
        missingContent: false
      };
    }

    const hub = await client.hubs.get(hubId);
    const repoIds = typeof repoId === 'string' ? [repoId] : repoId || [];
    const folderIds = typeof folderId === 'string' ? [folderId] : folderId || [];
    const contentRepositories = await (repoId != null
      ? Promise.all(repoIds.map(id => client.contentRepositories.get(id)))
      : paginator(hub.related.contentRepositories.list));

    const folders = folderId != null ? await Promise.all(folderIds.map(id => client.folders.get(id))) : [];

    folderId != null
      ? await Promise.all(
          folders.map(async source => {
            const items = await paginator(source.related.contentItems.list, { status: Status.ARCHIVED });
            contentItems.push(...items);
          })
        )
      : await Promise.all(
          contentRepositories.map(async source => {
            const items = await paginator(source.related.contentItems.list, { status: Status.ARCHIVED });
            contentItems.push(...items);
          })
        );

    return (
      (await filterContentItems({
        revertLog,
        facet,
        contentItems
      })) || {
        contentItems: [],
        missingContent: false
      }
    );
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
  ignoreError
}: {
  contentItems: ContentItem[];
  force?: boolean;
  silent?: boolean;
  logFile?: string;
  allContent: boolean;
  missingContent: boolean;
  ignoreError?: boolean;
}): Promise<void> => {
  if (contentItems.length == 0) {
    console.log('Nothing found to unarchive, aborting.');
    return;
  }

  console.log('The following content items will be unarchived:');
  contentItems.forEach((contentItem: ContentItem) => {
    console.log(` ${contentItem.label} (${contentItem.id})`);
  });
  console.log(`Total: ${contentItems.length}`);

  if (!force) {
    const yes = await confirmArchive('unarchive', 'content item', allContent, missingContent);
    if (!yes) {
      return;
    }
  }

  const timestamp = Date.now().toString();
  const log = new ArchiveLog(`Content Items Unarchive Log - ${timestamp}\n`);

  let successCount = 0;

  for (let i = 0; i < contentItems.length; i++) {
    try {
      const deliveryKey = contentItems[i].body._meta.deliveryKey;
      contentItems[i] = await contentItems[i].related.unarchive();

      if (contentItems[i].body._meta.deliveryKey != deliveryKey) {
        // Restore the delivery key if present. (only on ARCHIVE revert)
        contentItems[i].body._meta.deliveryKey = deliveryKey;
        await contentItems[i].related.update(contentItems[i]);
      }

      log.addAction('UNARCHIVE', `${contentItems[i].id}\n`);
      successCount++;
    } catch (e) {
      log.addComment(`UNARCHIVE FAILED: ${contentItems[i].id}`);
      log.addComment(e.toString());

      if (ignoreError) {
        log.warn(`Failed to unarchive ${contentItems[i].label} (${contentItems[i].id}), continuing.`, e);
      } else {
        log.error(`Failed to unarchive ${contentItems[i].label} (${contentItems[i].id}), aborting.`, e);
        break;
      }
    }
  }

  if (!silent && logFile) {
    await log.writeToFile(logFile.replace('<DATE>', timestamp));
  }

  console.log(`Unarchived ${successCount} content items.`);
};

export const handler = async (argv: Arguments<UnarchiveOptions & ConfigurationParameters>): Promise<void> => {
  const { id, logFile, force, silent, ignoreError, hubId, revertLog, repoId, folderId } = argv;
  const facet = withOldFilters(argv.facet, argv);
  const client = dynamicContentClientFactory(argv);

  const allContent = !id && !facet && !revertLog && !folderId && !repoId;

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
    console.log('No filter was given, archiving all content');
  }

  const { contentItems, missingContent } = await getContentItems({
    client,
    id,
    hubId,
    repoId,
    folderId,
    revertLog,
    facet
  });

  await processItems({
    contentItems,
    force,
    silent,
    logFile,
    allContent,
    missingContent,
    ignoreError
  });
};

// log format:
// UNARCHIVE <content item id>
