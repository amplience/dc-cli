import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentRepository, ContentType, DynamicContent, Hub } from 'dc-management-sdk-js';
import { isEqual } from 'lodash';
import { table } from 'table';
import chalk from 'chalk';
import { ImportResult, loadJsonFromDirectory, UpdateStatus } from '../../services/import.service';
import { streamTableOptions } from '../../common/table/table.consts';
import { ImportBuilderOptions } from '../../interfaces/import-builder-options.interface';
import { FileLog } from '../../common/file-log';
import { getDefaultLogPath } from '../../common/log-helpers';
import { ResourceStatus, Status } from '../../common/dc-management-sdk-js/resource-status';

export const command = 'import <dir>';

export const desc = 'Import Content Types';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('type', 'import', platform);

export type CommandParameters = {
  sync: boolean;
};

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Path to Content Type definitions',
    type: 'string'
  });

  yargs.option('sync', {
    describe: 'Automatically sync Content Type schema',
    type: 'boolean',
    default: false
  });

  yargs.option('logFile', {
    type: 'string',
    default: LOG_FILENAME,
    describe: 'Path to a log file to write to.'
  });
};

export class ContentTypeWithRepositoryAssignments extends ContentType {
  repositories?: string[];
}

export const storedContentTypeMapper = (
  contentType: ContentTypeWithRepositoryAssignments,
  storedContentTypes: ContentType[]
): ContentTypeWithRepositoryAssignments => {
  const found = storedContentTypes.find(
    storedContentType => storedContentType.contentTypeUri === contentType.contentTypeUri
  );
  const mutatedContentType = found ? { ...contentType, id: found.id } : contentType;

  return new ContentTypeWithRepositoryAssignments(mutatedContentType);
};

type ContentTypeUri = string;
type ContentTypeFile = string;

export const validateNoDuplicateContentTypeUris = (importedContentTypes: {
  [filename: string]: ContentType;
}): void | never => {
  const uriToFilenameMap = new Map<ContentTypeUri, ContentTypeFile[]>(); // map: uri x filenames
  for (const [filename, contentType] of Object.entries(importedContentTypes)) {
    if (contentType.contentTypeUri) {
      const otherFilenames: string[] = uriToFilenameMap.get(contentType.contentTypeUri) || [];
      if (filename) {
        uriToFilenameMap.set(contentType.contentTypeUri, [...otherFilenames, filename]);
      }
    }
  }
  const uniqueDuplicateUris: [ContentTypeUri, ContentTypeFile[]][] = [];
  uriToFilenameMap.forEach((filenames, uri) => {
    if (filenames.length > 1) {
      uniqueDuplicateUris.push([uri, filenames]);
    }
  });

  if (uniqueDuplicateUris.length > 0) {
    throw new Error(
      `Content Types must have unique uri values. Duplicate values found:-\n${uniqueDuplicateUris
        .map(([uri, filenames]) => `  uri: '${uri}' in files: [${filenames.map(f => `'${f}'`).join(', ')}]`)
        .join('\n')}`
    );
  }
};

export const filterContentTypesById = (
  idFilter: string[],
  importedContentTypes: {
    [filename: string]: ContentType;
  }
): void | never => {
  for (const [filename, contentType] of Object.entries(importedContentTypes)) {
    if (contentType.contentTypeUri) {
      if (idFilter.indexOf(contentType.id as string) === -1) {
        delete importedContentTypes[filename];
      }
    }
  }
};

export const doCreate = async (hub: Hub, contentType: ContentType, log: FileLog): Promise<ContentType> => {
  try {
    const result = await hub.related.contentTypes.register(new ContentType(contentType));

    log.addAction('CREATE', `${result.id}`);

    return result;
  } catch (err) {
    throw new Error(`Error registering content type ${contentType.contentTypeUri}: ${err.message || err}`);
  }
};

const equals = (a: ContentType, b: ContentType): boolean =>
  a.id === b.id && a.contentTypeUri === b.contentTypeUri && isEqual(a.settings, b.settings);

export const doUpdate = async (
  client: DynamicContent,
  contentType: ContentTypeWithRepositoryAssignments,
  log: FileLog
): Promise<{ contentType: ContentType; updateStatus: UpdateStatus }> => {
  let retrievedContentType: ContentType;
  try {
    // Get the existing content type
    retrievedContentType = await client.contentTypes.get(contentType.id || '');
  } catch (err) {
    throw new Error(`Error unable to get content type ${contentType.id}: ${err.message}`);
  }

  if ((retrievedContentType as ResourceStatus).status === Status.ARCHIVED) {
    try {
      // Resurrect this type before updating it.
      retrievedContentType = await retrievedContentType.related.unarchive();
    } catch (err) {
      throw new Error(`Error unable unarchive content type ${contentType.id}: ${err.message}`);
    }
  }

  // Check if an update is required
  contentType.settings = { ...retrievedContentType.settings, ...contentType.settings };

  let updatedContentType: ContentType | undefined;

  if (equals(retrievedContentType, contentType)) {
    return { contentType: retrievedContentType, updateStatus: UpdateStatus.SKIPPED };
  }

  try {
    // Update the content-type
    updatedContentType = await retrievedContentType.related.update(contentType);

    log.addAction('UPDATE', `${contentType.id}`);

    return { contentType: updatedContentType, updateStatus: UpdateStatus.UPDATED };
  } catch (err) {
    throw new Error(`Error updating content type ${contentType.id}: ${err.message || err}`);
  }
};

export const doSync = async (
  client: DynamicContent,
  contentType: ContentTypeWithRepositoryAssignments
): Promise<{ contentType: ContentType; updateStatus: UpdateStatus }> => {
  let retrievedContentType: ContentType;
  try {
    // Get the existing content type
    retrievedContentType = await client.contentTypes.get(contentType.id || '');
  } catch (err) {
    throw new Error(`Error unable to get content type ${contentType.id}: ${err.message}`);
  }

  try {
    // Update the ContentTypeSchema of the updated ContentType
    await retrievedContentType.related.contentTypeSchema.update();
    return { contentType: retrievedContentType, updateStatus: UpdateStatus.UPDATED };
  } catch (err) {
    throw new Error(`Error updating the content type schema of the content type ${contentType.id}: ${err.message}`);
  }
};

export type MappedContentRepositories = Map<string, ContentRepository>;

const validateRepositories = (repositories: unknown): boolean =>
  Array.isArray(repositories) && repositories.every(repo => typeof repo === 'string');

export const synchronizeContentTypeRepositories = async (
  contentType: ContentTypeWithRepositoryAssignments,
  namedRepositories: MappedContentRepositories
): Promise<boolean> => {
  if (!validateRepositories(contentType.repositories)) {
    throw new Error('Invalid format supplied for repositories. Please provide an array of repository names');
  }

  const assignedRepositories: MappedContentRepositories = new Map<string, ContentRepository>();
  namedRepositories.forEach(contentRepository => {
    const contentRepositoryContentTypes = contentRepository.contentTypes || [];
    contentRepositoryContentTypes.forEach(assignedContentTypes => {
      if (assignedContentTypes.hubContentTypeId === contentType.id) {
        assignedRepositories.set(contentRepository.name || '', contentRepository);
      }
    });
  });

  const contentTypeId = contentType.id || '';

  const definedContentRepository = (contentType.repositories || []).filter(
    (value, index, array) => array.indexOf(value) === index
  );

  let changedAssignment = false;
  for (const repo of definedContentRepository) {
    if (!assignedRepositories.has(repo)) {
      const contentRepository = namedRepositories.get(repo);
      if (!contentRepository) {
        throw new Error(`Unable to find a Content Repository named: ${repo}`);
      }
      await contentRepository.related.contentTypes.assign(contentTypeId);
      changedAssignment = true;
    } else {
      assignedRepositories.delete(repo);
    }
  }

  for (const assignedRepository of assignedRepositories.values()) {
    await assignedRepository.related.contentTypes.unassign(contentTypeId);
    changedAssignment = true;
  }

  return changedAssignment;
};

export const processContentTypes = async (
  contentTypes: ContentTypeWithRepositoryAssignments[],
  client: DynamicContent,
  hub: Hub,
  sync: boolean,
  log: FileLog
): Promise<void> => {
  const data: string[][] = [];
  const contentRepositoryList = await paginator<ContentRepository>(hub.related.contentRepositories.list, {});
  const namedRepositories: MappedContentRepositories = new Map<string, ContentRepository>(
    contentRepositoryList.map(value => [value.name || '', value])
  );

  data.push([chalk.bold('ID'), chalk.bold('Schema ID'), chalk.bold('Result')]);
  for (const contentType of contentTypes) {
    let status: ImportResult;
    let contentTypeResult: ContentType;

    if (contentType.id) {
      status = 'UP-TO-DATE';
      const result = await doUpdate(client, contentType, log);
      if (result.updateStatus === UpdateStatus.UPDATED) {
        status = 'UPDATED';
      }
      contentTypeResult = result.contentType;

      if (sync) {
        const syncResult = await doSync(client, contentType);
        if (syncResult.updateStatus === UpdateStatus.UPDATED) {
          status = 'UPDATED';
        }
      }
    } else {
      contentTypeResult = await doCreate(hub, contentType, log);
      status = 'CREATED';
    }

    if (
      contentType.repositories &&
      (await synchronizeContentTypeRepositories(
        new ContentTypeWithRepositoryAssignments({ ...contentType, ...contentTypeResult }),
        namedRepositories
      ))
    ) {
      status = contentType.id ? 'UPDATED' : 'CREATED';
    }

    data.push([contentTypeResult.id || 'UNKNOWN', contentType.contentTypeUri || '', status]);
  }

  log.appendLine(table(data, streamTableOptions));
};

export const handler = async (
  argv: Arguments<ImportBuilderOptions & ConfigurationParameters & CommandParameters>,
  idFilter?: string[]
): Promise<void> => {
  const { dir, sync, logFile } = argv;
  const importedContentTypes = loadJsonFromDirectory<ContentTypeWithRepositoryAssignments>(
    dir,
    ContentTypeWithRepositoryAssignments
  );
  if (Object.keys(importedContentTypes).length === 0) {
    throw new Error(`No content types found in ${dir}`);
  }
  validateNoDuplicateContentTypeUris(importedContentTypes);

  if (idFilter) {
    filterContentTypesById(idFilter, importedContentTypes);
  }

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;

  const activeContentTypes = await paginator(hub.related.contentTypes.list, { status: Status.ACTIVE });
  const archivedContentTypes = await paginator(hub.related.contentTypes.list, { status: Status.ARCHIVED });
  const storedContentTypes = [...activeContentTypes, ...archivedContentTypes];

  for (const [filename, importedContentType] of Object.entries(importedContentTypes)) {
    importedContentTypes[filename] = storedContentTypeMapper(importedContentType, storedContentTypes);
  }
  await processContentTypes(Object.values(importedContentTypes), client, hub, sync, log);

  if (typeof logFile !== 'object') {
    // Only close the log if it was opened by this handler.
    await log.close();
  }
};
