import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { FileLog } from '../../common/file-log';
import { join } from 'path';
import { equalsOrRegex } from '../../common/filter/filter';
import sanitize from 'sanitize-filename';
import { uniqueFilenamePath, writeJsonToFile } from '../../services/export.service';

import { ExportItemBuilderOptions } from '../../interfaces/export-item-builder-options.interface';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentItem, Folder, DynamicContent, Hub, ContentRepository } from 'dc-management-sdk-js';

import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { ContentDependancyTree, RepositoryContentItem } from '../../common/content-item/content-dependancy-tree';
import { ContentMapping } from '../../common/content-item/content-mapping';
import { getDefaultLogPath } from '../../common/log-helpers';
import { AmplienceSchemaValidator, defaultSchemaLookup } from '../../common/content-item/amplience-schema-validator';
import { Status } from '../../common/dc-management-sdk-js/resource-status';

interface PublishedContentItem {
  lastPublishedVersion?: number;
  lastPublishedDate?: string;
}

export const command = 'export <dir>';

export const desc = 'Export Content Items';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('item', 'export', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Output directory for the exported Content Items',
      type: 'string',
      requiresArg: true
    })
    .option('repoId', {
      type: 'string',
      describe:
        'Export content from within a given repository. Directory structure will start at the specified repository. Will automatically export all contained folders.'
    })
    .option('folderId', {
      type: 'string',
      describe:
        'Export content from within a given folder. Directory structure will start at the specified folder. Can be used in addition to repoId.'
    })
    .option('schemaId', {
      type: 'string',
      describe:
        'Export content with a given or matching Schema ID. A regex can be provided, surrounded with forward slashes. Can be used in combination with other filters.'
    })
    .option('name', {
      type: 'string',
      describe:
        'Export content with a given or matching Name. A regex can be provided, surrounded with forward slashes. Can be used in combination with other filters.'
    })
    .option('publish', {
      type: 'boolean',
      boolean: true,
      describe: 'When available, export the last published version of a content item rather than its newest version.'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.'
    });
};

const getOrAddFolderPath = async (
  folderToPathMap: Map<string, string>,
  client: DynamicContent,
  folder: Folder,
  log: FileLog
): Promise<string> => {
  const id = folder.id as string;

  const mapResult = folderToPathMap.get(id);
  if (mapResult !== undefined) {
    return mapResult;
  }

  // Build the path for this folder.
  const name = sanitize(folder.name as string);
  let path: string;
  try {
    const parent = await folder.related.folders.parent();

    path = `${join(await getOrAddFolderPath(folderToPathMap, client, parent, log), name)}`;
  } catch {
    log.appendLine(`Could not determine path for ${folder.name}. Placing in base directory.`);
    path = `${name}`;
  }

  folderToPathMap.set(id, path);
  return path;
};

const getContentItems = async (
  folderToPathMap: Map<string, string>,
  client: DynamicContent,
  hub: Hub,
  dir: string,
  log: FileLog,
  repoId?: string | string[],
  folderId?: string | string[],
  publish?: boolean
): Promise<{ path: string; item: ContentItem }[]> => {
  const items: { path: string; item: ContentItem }[] = [];

  const folderIds = typeof folderId === 'string' ? [folderId] : folderId || [];

  const repoItems: ContentItem[] = [];

  const repoIds = typeof repoId === 'string' ? [repoId] : repoId || [];

  const repositories = await (repoId != null || folderId != null
    ? Promise.all(repoIds.map(id => client.contentRepositories.get(id)))
    : paginator(hub.related.contentRepositories.list));

  let specifyBasePaths = repositories.length + folderIds.length > 1;

  for (let i = 0; i < repositories.length; i++) {
    const repository = repositories[i];
    const baseDir = specifyBasePaths ? `${sanitize(repository.label as string)}/` : '';
    await ensureDirectoryExists(join(dir, baseDir));
    const newFolders = await paginator(repository.related.folders.list);
    newFolders.forEach(folder => {
      if (folderIds.indexOf(folder.id as string) === -1) {
        folderIds.push(folder.id as string);
      }
      folderToPathMap.set(folder.id as string, join(baseDir, `${sanitize(folder.name as string)}/`));
    });

    // Add content items in repo base folder. Cache the other items so we don't have to request them again.
    let newItems: ContentItem[];
    try {
      const allItems = await paginator(repository.related.contentItems.list, { status: Status.ACTIVE });

      Array.prototype.push.apply(repoItems, allItems);
      newItems = allItems.filter(item => item.folderId == null);
    } catch (e) {
      log.warn(`Could not get items from repository ${repository.name} (${repository.id})`, e);
      continue;
    }

    Array.prototype.push.apply(items, newItems.map(item => ({ item, path: baseDir })));
  }

  const parallelism = 10;
  const folders = await Promise.all(folderIds.map(id => client.folders.get(id)));
  log.appendLine(`Found ${folders.length} base folders.`);

  specifyBasePaths = specifyBasePaths || folders.length > 1;

  const nextFolders: Folder[] = [];
  let processFolders = folders;
  let baseFolder = true;

  while (processFolders.length > 0) {
    const promises = processFolders.map(
      async (folder: Folder): Promise<void> => {
        if (baseFolder) {
          if (!folderToPathMap.has(folder.id as string)) {
            folderToPathMap.set(folder.id as string, specifyBasePaths ? `${sanitize(folder.name as string)}/` : '');
          }
        }
        const path = await getOrAddFolderPath(folderToPathMap, client, folder, log);
        log.appendLine(`Processing ${path}...`);

        let newItems: ContentItem[];
        // If we already have seen items in this folder, use those. Otherwise try get them explicitly.
        // This may happen for folders in selected repositories if they are empty, but it will be a no-op (and is unavoidable).
        newItems = repoItems.filter(item => item.folderId == folder.id);
        if (newItems.length == 0) {
          log.appendLine(`Fetching additional folder: ${folder.name}`);
          try {
            newItems = (await paginator(folder.related.contentItems.list)).filter(item => item.status === 'ACTIVE');
          } catch (e) {
            log.warn(`Could not get items from folder ${folder.name} (${folder.id})`, e);
            return;
          }
        }
        Array.prototype.push.apply(items, newItems.map(item => ({ item, path: path })));

        try {
          const subfolders = await paginator(folder.related.folders.list);
          Array.prototype.push.apply(nextFolders, subfolders);
        } catch (e) {
          log.warn(`Could not get subfolders from folder ${folder.name} (${folder.id})`, e);
        }
      }
    );

    await Promise.all(promises);

    baseFolder = false;
    processFolders = nextFolders.splice(0, Math.min(nextFolders.length, parallelism));
  }

  if (publish) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const publishedVersion: number | undefined = (item.item as PublishedContentItem).lastPublishedVersion;
      if (publishedVersion != null && publishedVersion != item.item.version) {
        const newVersion = await item.item.related.contentItemVersion(publishedVersion);
        item.item = newVersion;
      }
    }
  }

  return items;
};

export const handler = async (argv: Arguments<ExportItemBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, repoId, folderId, schemaId, name, logFile, publish } = argv;

  const dummyRepo = new ContentRepository();

  const folderToPathMap: Map<string, string> = new Map();
  const client = dynamicContentClientFactory(argv);
  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;
  const hub = await client.hubs.get(argv.hubId);

  log.appendLine('Retrieving content items, please wait.');
  let items = await getContentItems(folderToPathMap, client, hub, dir, log, repoId, folderId, publish);

  // Filter using the schemaId and name, if present.
  if (schemaId != null) {
    const schemaIds: string[] = Array.isArray(schemaId) ? schemaId : [schemaId];
    items = items.filter(
      ({ item }: { item: ContentItem }) => schemaIds.findIndex(id => equalsOrRegex(item.body._meta.schema, id)) !== -1
    );
  }
  if (name != null) {
    const names: string[] = Array.isArray(name) ? name : [name];
    items = items.filter(
      ({ item }: { item: ContentItem }) => names.findIndex(name => equalsOrRegex(item.label as string, name)) !== -1
    );
  }

  log.appendLine('Scanning for dependancies.');

  const repoItems: RepositoryContentItem[] = items.map(item => ({ repo: dummyRepo, content: item.item }));

  const missingIDs = new Set<string>();
  let newMissingIDs: Set<string>;
  do {
    const tree = new ContentDependancyTree(repoItems, new ContentMapping());

    newMissingIDs = new Set();
    tree.filterAny(item => {
      const missingDeps = item.dependancies.filter(dep => !tree.byId.has(dep.dependancy.id as string));
      missingDeps.forEach(dep => {
        const id = dep.dependancy.id as string;
        if (!missingIDs.has(id)) {
          newMissingIDs.add(id);
        }
        missingIDs.add(id);
      });
      return missingDeps.length > 0;
    });

    // Add the newly found content to the items list.
    const newIdArray = Array.from(newMissingIDs);
    for (let i = 0; i < newIdArray.length; i++) {
      try {
        const item = await client.contentItems.get(newIdArray[i]);
        // Add this item as a dependancy.
        repoItems.push({ repo: await item.related.contentRepository(), content: item });
      } catch {}
    }
  } while (newMissingIDs.size > 0);

  if (missingIDs.size > 0) {
    // There are missing content items. We'll need to fetch them and see what their deal is.
    const missingIdArray = Array.from(missingIDs);

    const allRepo = repoId == null && folderId == null;

    for (let i = 0; i < missingIdArray.length; i++) {
      const repoItem = repoItems.find(ri => ri.content.id == missingIdArray[i]);

      if (repoItem != null) {
        // The item is active and should probably be included.
        const item = repoItem.content;
        let path = '_dependancies/';

        if (allRepo) {
          // Find the repository for this item.
          const repo = repoItem.repo;

          path = join(sanitize(repo.label as string), path);
        }

        items.push({ item, path });

        log.appendLine(
          item.status === 'ACTIVE'
            ? `Referenced content '${item.label}' added to the export.`
            : `Referenced content '${item.label}' is archived, but is needed as a dependancy. It has been added to the export.`
        );
      } else {
        log.appendLine(`Referenced content ${missingIdArray[i]} does not exist.`);
      }
    }
  }

  log.appendLine('Saving content items.');
  const filenames: string[] = [];

  const schemas = await paginator(hub.related.contentTypeSchema.list);
  const types = await paginator(hub.related.contentTypes.list);

  const validator = new AmplienceSchemaValidator(defaultSchemaLookup(types, schemas));

  for (let i = 0; i < items.length; i++) {
    const { item, path } = items[i];

    try {
      const errors = await validator.validate(item.body);
      if (errors.length > 0) {
        log.warn(`${item.label} does not validate under the available schema. It may not import correctly.`);
        log.appendLine(JSON.stringify(errors, null, 2));
      }
    } catch (e) {
      log.warn(`Could not validate ${item.label} as there is a problem with the schema:`, e);
    }

    let resolvedPath: string;
    resolvedPath = path;

    const directory = join(dir, resolvedPath);
    resolvedPath = uniqueFilenamePath(directory, `${sanitize(item.label as string)}`, 'json', filenames);
    filenames.push(resolvedPath);
    log.appendLine(resolvedPath);
    await ensureDirectoryExists(directory);

    if (argv.exportedIds) {
      argv.exportedIds.push(item.id as string);
    }

    writeJsonToFile(resolvedPath, item);
  }

  if (typeof logFile !== 'object') {
    await log.close();
  }
};
