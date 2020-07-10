import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { dirname, join } from 'path';
import { equalsOrRegex } from '../../common/filter/filter';
import sanitize from 'sanitize-filename';
import { uniqueFilenamePath, writeJsonToFile } from '../../services/export.service';

import { mkdir, writeFile, exists, lstat } from 'fs';
import { promisify } from 'util';
import { ExportItemBuilderOptions } from '../../interfaces/export-item-builder-options.interface';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentItem, Folder, DynamicContent, Hub, ContentRepository } from 'dc-management-sdk-js';

import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { ContentDependancyTree } from '../../common/content-item/content-dependancy-tree';
import { ContentMapping } from '../../common/content-item/content-mapping';

export const command = 'export <dir>';

export const desc = 'Export Content Items';

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
    });
};

export const writeItemBody = async (filename: string, body?: string): Promise<void> => {
  if (!body) {
    return;
  }

  const dir = dirname(filename);
  if (await promisify(exists)(dir)) {
    const dirStat = await promisify(lstat)(dir);
    if (!dirStat || !dirStat.isDirectory()) {
      throw new Error(`Unable to write schema to "${filename}" as "${dir}" is not a directory.`);
    }
  } else {
    try {
      await promisify(mkdir)(dir);
    } catch {
      throw new Error(`Unable to create directory: "${dir}".`);
    }
  }

  try {
    await promisify(writeFile)(filename, body);
  } catch {
    throw new Error(`Unable to write file: "${filename}".`);
  }
};

const getOrAddFolderPath = async (
  folderToPathMap: Map<string, string>,
  client: DynamicContent,
  folderOrId: Folder | string | undefined,
  baseDir?: string
): Promise<string> => {
  if (folderOrId == null) return '';
  const id = typeof folderOrId === 'string' ? folderOrId : (folderOrId.id as string);

  const mapResult = folderToPathMap.get(id);
  if (mapResult !== undefined) {
    return mapResult;
  }

  // Build the path for this folder.
  const folder = typeof folderOrId === 'string' ? await client.folders.get(folderOrId) : folderOrId;

  const name = sanitize(folder.name as string);
  let path: string;
  try {
    const parent = await folder.related.folders.parent();

    path = `${join(await getOrAddFolderPath(folderToPathMap, client, parent), name)}`;
  } catch {
    console.log(`Could not determine path for ${folder.name}. Placing in base directory.`);
    path = `${name}`;
  }

  if (baseDir != null) {
    path = join(baseDir, path);
  }

  folderToPathMap.set(id, path);
  return path;
};

export const filterContentItemsBySchemaId = (
  listToFilter: ContentItem[],
  listToMatch: string[] = []
): ContentItem[] => {
  if (listToMatch.length === 0) {
    return listToFilter;
  }

  const unmatchedIdList: string[] = listToMatch.filter(id => !listToFilter.some(item => item.body._meta.schema === id));
  if (unmatchedIdList.length > 0) {
    throw new Error(
      `Content matching the following schema ID(s) could not be found: [${unmatchedIdList
        .map(u => `'${u}'`)
        .join(', ')}].\nNothing was exported, exiting.`
    );
  }

  return listToFilter.filter(item => listToMatch.some(id => item.body._meta.schema === id));
};

const getContentItems = async (
  folderToPathMap: Map<string, string>,
  client: DynamicContent,
  hub: Hub,
  dir: string,
  repoId?: string | string[],
  folderId?: string | string[]
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
      const allItems = await paginator(repository.related.contentItems.list, { status: 'ACTIVE' });
      Array.prototype.push.apply(repoItems, allItems);
      newItems = allItems.filter(item => item.folderId == null);
    } catch (e) {
      console.error(`Error getting items from repository ${repository.name} (${repository.id}): ${e.toString()}`);
      continue;
    }

    Array.prototype.push.apply(items, newItems.map(item => ({ item, path: baseDir })));
  }

  const parallelism = 10;
  const folders = await Promise.all(folderIds.map(id => client.folders.get(id)));
  console.log(`Found ${folders.length} base folders.`);

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
        const path = await getOrAddFolderPath(folderToPathMap, client, folder);
        console.log(`Processing ${path}...`);

        let newItems: ContentItem[];
        // If we already have seen items in this folder, use those. Otherwise try get them explicitly.
        // This may happen for folders in selected repositories if they are empty, but it will be a no-op (and is unavoidable).
        newItems = repoItems.filter(item => item.folderId == folder.id);
        if (newItems.length == 0) {
          console.log(`Fetching additional folder: ${folder.name}`);
          try {
            newItems = (await paginator(folder.related.contentItems.list)).filter(item => item.status === 'ACTIVE');
          } catch (e) {
            console.error(`Error getting items from folder ${folder.name} (${folder.id}): ${e.toString()}`);
            return;
          }
        }
        Array.prototype.push.apply(items, newItems.map(item => ({ item, path: path })));

        try {
          const subfolders = await paginator(folder.related.folders.list);
          Array.prototype.push.apply(nextFolders, subfolders);
        } catch (e) {
          console.error(`Error getting subfolders from folder ${folder.name} (${folder.id}): ${e.toString()}`);
        }
      }
    );

    await Promise.all(promises);

    baseFolder = false;
    processFolders = nextFolders.splice(0, Math.min(nextFolders.length, parallelism));
  }
  return items;
};

export const handler = async (argv: Arguments<ExportItemBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, repoId, folderId, schemaId, name } = argv;

  const dummyRepo = new ContentRepository();

  const folderToPathMap: Map<string, string> = new Map();
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  console.log('Retrieving content items, please wait.');
  let items = await getContentItems(folderToPathMap, client, hub, dir, repoId, folderId);

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

  console.log('Scanning for dependancies.');
  const tree = new ContentDependancyTree(
    items.map(item => ({ repo: dummyRepo, content: item.item })),
    new ContentMapping()
  );

  const missingIDs = new Set<string>();
  const invalidContentItems = tree.filterAny(item => {
    const missingDeps = item.dependancies.filter(dep => !tree.byId.has(dep.dependancy.id as string));
    missingDeps.forEach(dep => {
      if (dep.dependancy.id != null) {
        missingIDs.add(dep.dependancy.id);
      }
    });
    return missingDeps.length > 0;
  });

  if (invalidContentItems) {
    // There are missing content items. We'll need to fetch them and see what their deal is.
    const missingIdArray = Array.from(missingIDs);
    for (let i = 0; i < missingIdArray.length; i++) {
      let item: ContentItem | null = null;

      try {
        item = await client.contentItems.get(missingIdArray[i]);
      } catch {}

      if (item != null) {
        if (item.status === 'ACTIVE') {
          // The item is active and should probably be included.
          const path = '_dependancies/';
          items.push({ item, path });

          console.log(`Referenced content '${item.label}' added to the export.`);
        } else {
          // The item is archived and should not be included. Make a note to the user.
          console.log(`Referenced content '${item.label}' is archived, so was not exported.`);
        }
      } else {
        console.log(`Referenced content ${missingIdArray[i]} does not exist.`);
      }
    }
  }

  console.log('Saving content items.');
  const filenames: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const { item, path } = items[i];

    let resolvedPath: string;
    resolvedPath = path;

    const directory = join(dir, resolvedPath);
    resolvedPath = uniqueFilenamePath(directory, `${sanitize(item.label as string)}`, 'json', filenames);
    filenames.push(resolvedPath);
    console.log(resolvedPath);
    await ensureDirectoryExists(directory);

    writeJsonToFile(resolvedPath, item);
  }
};
