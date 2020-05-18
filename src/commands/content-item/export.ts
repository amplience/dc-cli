import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { dirname, join, sep } from 'path';
import { equalsOrRegex } from '../../common/filter/filter';
import {
  ExportResult,
  nothingExportedExit,
  promptToOverwriteExports,
  uniqueFilename,
  writeJsonToFile
} from '../../services/export.service';

import { mkdir, writeFile, exists, lstat } from 'fs';
import { promisify } from 'util';
import { ExportItemBuilderOptions } from '../../interfaces/export-item-builder-options.interface';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentItem, Folder, DynamicContent, Hub } from 'dc-management-sdk-js';

export const command = 'export <dir>';

export const desc = 'Export Content Types';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Output directory for the exported Content Type definitions',
      type: 'string'
    })
    .option('repoId', {
      type: 'string',
      describe:
        'Export content from within a given repository. Directory structure will start at the specified repository.',
      requiresArg: true
    })
    .option('folderId', {
      type: 'string',
      describe:
        'Export content from within a given folder. Directory structure will start at the specified folder. Overrides repoId.',
      requiresArg: true
    })
    .option('schemaId', {
      type: 'string',
      describe:
        'Export content with a given or matching Schema ID. A regex can be provided, surrounded with forward slashes. Can be used in combination with other filters.',
      requiresArg: true
    })
    .option('name', {
      type: 'string',
      describe:
        'Export content with a given or matching Name. A regex can be provided, surrounded with forward slashes. Can be used in combination with other filters.',
      requiresArg: true
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

const folderToPathMap: Map<string, string> = new Map();

const getOrAddFolderPath = async (
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

  let path: string;
  try {
    const parent = await folder.related.folders.parent();

    path = `${await getOrAddFolderPath(client, parent)}/${folder.name}`;
  } catch {
    path = `${folder.name}`;
  }

  if (baseDir != null) {
    path = join(baseDir, path);
  }

  folderToPathMap.set(id, path);
  return path;
};

const ensureDirectoryExists = async (dir: string): Promise<void> => {
  if (await promisify(exists)(dir)) {
    const dirStat = await promisify(lstat)(dir);
    if (!dirStat || !dirStat.isDirectory()) {
      throw new Error(`"${dir}" already exists and is not a directory.`);
    }
  } else {
    // Ensure parent directory exists.
    const parentPath = dir.split(sep);
    parentPath.pop();
    const parent = parentPath.join(sep);
    if (parent !== undefined) {
      await ensureDirectoryExists(parent);
    }

    try {
      await promisify(mkdir)(dir);
    } catch {
      throw new Error(`Unable to create directory: "${dir}".`);
    }
  }
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
  client: DynamicContent,
  hub: Hub,
  repoId?: string | string[],
  folderId?: string | string[]
): Promise<{ path: Promise<string>; item: ContentItem }[]> => {
  const items: { path: Promise<string>; item: ContentItem }[] = [];

  if (folderId != null) {
    const folderIds = typeof folderId === 'string' ? [folderId] : folderId;
    const folders = await Promise.all(folderIds.map(id => client.folders.get(id)));
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      folderToPathMap.set(folder.id as string, folders.length > 1 ? `${folder.name}/` : '');
      const newItems = await paginator(folder.related.contentItems.list, { status: 'ACTIVE' });
      Array.prototype.push.apply(
        items,
        newItems.map(item => ({ item, path: getOrAddFolderPath(client, item.folderId) }))
      );

      const subfolders = await paginator(folder.related.folders.list);
      Array.prototype.push.apply(folders, subfolders);
    }
  } else {
    const repoIds = typeof repoId === 'string' ? [repoId] : repoId || [];
    const repositories = await (repoId != null
      ? Promise.all(repoIds.map(id => client.contentRepositories.get(id)))
      : paginator(hub.related.contentRepositories.list));
    for (let i = 0; i < repositories.length; i++) {
      const repository = repositories[i];
      const baseDir = `${repository.label}/`;
      const newItems = await paginator(repository.related.contentItems.list, { status: 'ACTIVE' });
      Array.prototype.push.apply(
        items,
        newItems.map(item => ({ item, path: getOrAddFolderPath(client, item.folderId, baseDir) }))
      );
    }
  }
  return items;
};

// Output Plan:
//
// {repo}/{folderTree}/{label}.json
//
// repo is only present if all/more than one repository is specified, and a specific folder is not specified.
// folder is only present if a specific folder is not specified.
//
// schema ID must be included in the json. (used to link relevant content type)
//

export const handler = async (argv: Arguments<ExportItemBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, repoId, folderId, schemaId, name } = argv;

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  let items = await getContentItems(client, hub, repoId, folderId);

  // Filter using the schemaId and name, if present.
  if (schemaId != null) {
    const schemaIds: string[] = Array.isArray(schemaId) ? schemaId : [schemaId];
    items = items.filter(
      ({ item }: { item: ContentItem }) => schemaIds.findIndex(id => equalsOrRegex(item.body._meta.schemaId, id)) != -1
    );
  }
  if (name != null) {
    const names: string[] = Array.isArray(name) ? name : [name];
    items = items.filter(
      ({ item }: { item: ContentItem }) => names.findIndex(name => equalsOrRegex(item.label as string, name)) != -1
    );
  }

  for (let i = 0; i < items.length; i++) {
    const { item, path } = items[i];

    let resolvedPath: string;
    try {
      resolvedPath = await path;
    } catch {
      console.log(`Could not determine folder for ${item.label}.`);
      continue;
    }
    const directory = join(dir, resolvedPath);
    resolvedPath = join(directory, `${item.label}.json`);
    await ensureDirectoryExists(directory);

    writeJsonToFile(resolvedPath, item);
  }
};
