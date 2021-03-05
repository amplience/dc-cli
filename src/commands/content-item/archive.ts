import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { confirmArchive } from '../../common/archive/archive-helpers';
import ArchiveOptions from '../../common/archive/archive-options';
import { ContentItem, DynamicContent } from 'dc-management-sdk-js';
import { equalsOrRegex } from '../../common/filter/filter';
import { getDefaultLogPath } from '../../common/log-helpers';
import { Status } from '../../common/dc-management-sdk-js/resource-status';

export const command = 'archive [id]';

export const desc = 'Archive Content Items';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('content-item', 'archive', platform);

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
    .option('name', {
      type: 'string',
      describe:
        'The name of a Content Item to be archived.\nA regex can be provided to select multiple items with similar or matching names (eg /.header/).\nA single --name option may be given to match a single content item pattern.\nMultiple --name options may be given to match multiple content items patterns at the same time, or even multiple regex.'
    })
    .option('contentType', {
      type: 'string',
      describe:
        'A pattern which will only archive content items with a matching Content Type Schema ID. A single --contentType option may be given to match a single schema id pattern.\\nMultiple --contentType options may be given to match multiple schema patterns at the same time.'
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
      describe: 'Path to a log file to write to.'
    });
};

export const filterContentItems = async ({
  revertLog,
  name,
  contentType,
  contentItems
}: {
  revertLog?: string;
  name?: string | string[];
  contentType?: string | string[];
  contentItems: ContentItem[];
}): Promise<{ contentItems: ContentItem[]; missingContent: boolean } | undefined> => {
  try {
    let missingContent = false;

    if (revertLog != null) {
      const log = await new ArchiveLog().loadFromFile(revertLog);
      const ids = log.getData('UNARCHIVE');
      const contentItemsFiltered = contentItems.filter(contentItem => ids.indexOf(contentItem.id || '') != -1);
      if (contentItems.length != ids.length) {
        missingContent = true;
      }

      return {
        contentItems: contentItemsFiltered,
        missingContent
      };
    }

    if (name != null) {
      const itemsArray: string[] = Array.isArray(name) ? name : [name];
      const contentItemsFiltered = contentItems.filter(
        item => itemsArray.findIndex(id => equalsOrRegex(item.label || '', id)) != -1
      );

      return {
        contentItems: contentItemsFiltered,
        missingContent
      };
    }

    if (contentType != null) {
      const itemsArray: string[] = Array.isArray(contentType) ? contentType : [contentType];
      const contentItemsFiltered = contentItems.filter(item => {
        return itemsArray.findIndex(id => equalsOrRegex(item.body._meta.schema, id)) != -1;
      });

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
  name,
  contentType
}: {
  client: DynamicContent;
  id?: string | string[];
  hubId: string;
  repoId?: string | string[];
  folderId?: string | string[];
  revertLog?: string;
  name?: string | string[];
  contentType?: string | string[];
}): Promise<{ contentItems: ContentItem[]; missingContent: boolean }> => {
  try {
    const contentItems: ContentItem[] = [];

    if (id != null) {
      const itemIds = Array.isArray(id) ? id : [id];
      const items = await Promise.all(itemIds.map(id => client.contentItems.get(id)));
      contentItems.push(...items);

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
            const items = await paginator(source.related.contentItems.list);

            contentItems.push(...items.filter(item => item.status == 'ACTIVE'));
          })
        )
      : await Promise.all(
          contentRepositories.map(async source => {
            const items = await paginator(source.related.contentItems.list, { status: Status.ACTIVE });
            contentItems.push(...items);
          })
        );

    return (
      (await filterContentItems({
        revertLog,
        name,
        contentType,
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
    console.log('Nothing found to archive, aborting.');
    return;
  }

  console.log('The following content items will be archived:');
  contentItems.forEach((contentItem: ContentItem) => {
    console.log(` ${contentItem.label} (${contentItem.id})`);
  });
  console.log(`Total: ${contentItems.length}`);

  if (!force) {
    const yes = await confirmArchive('archive', 'content item', allContent, missingContent);
    if (!yes) {
      return;
    }
  }

  const timestamp = Date.now().toString();
  const log = new ArchiveLog(`Content Items Archive Log - ${timestamp}\n`);

  let successCount = 0;

  for (let i = 0; i < contentItems.length; i++) {
    try {
      await contentItems[i].related.archive();

      log.addAction('ARCHIVE', `${contentItems[i].id}\n`);
      successCount++;
    } catch (e) {
      log.addComment(`ARCHIVE FAILED: ${contentItems[i].id}`);
      log.addComment(e.toString());

      if (ignoreError) {
        log.warn(`Failed to archive ${contentItems[i].label} (${contentItems[i].id}), continuing.`, e);
      } else {
        log.error(`Failed to archive ${contentItems[i].label} (${contentItems[i].id}), aborting.`, e);
        break;
      }
    }
  }

  if (!silent && logFile) {
    await log.writeToFile(logFile.replace('<DATE>', timestamp));
  }

  console.log(`Archived ${successCount} content items.`);
};

export const handler = async (argv: Arguments<ArchiveOptions & ConfigurationParameters>): Promise<void> => {
  const { id, logFile, force, silent, ignoreError, hubId, revertLog, repoId, folderId, name, contentType } = argv;
  const client = dynamicContentClientFactory(argv);

  const allContent = !id && !name && !contentType && !revertLog;

  if (repoId && id) {
    console.log('ID of content item is specified, ignoring repository ID');
  }

  if (id && name) {
    console.log('Please specify either a item name or an ID - not both.');
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
    contentType,
    name
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
// ARCHIVE <content item id>
