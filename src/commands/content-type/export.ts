import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentType, Status, ContentRepository } from 'dc-management-sdk-js';
import { table } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import chalk from 'chalk';
import {
  ExportResult,
  nothingExportedExit,
  promptToOverwriteExports,
  uniqueFilename,
  writeJsonToFile
} from '../../services/export.service';
import { loadJsonFromDirectory } from '../../services/import.service';
import { validateNoDuplicateContentTypeUris } from './import';
import { isEqual, compact } from 'lodash';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { FileLog } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { equalsOrRegex } from '../../common/filter/filter';
import { paginateWithProgress } from '../../common/dc-management-sdk-js/paginate-with-progress';
import { progressBar } from '../../common/progress-bar/progress-bar';

export const command = 'export <dir>';

export const desc = 'Export Content Types';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('type', 'export', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Output directory for the exported Content Type definitions',
      type: 'string'
    })
    .option('schemaId', {
      type: 'string',
      describe:
        'The Schema ID of a Content Type to be exported.\nIf no --schemaId option is given, all content types for the hub are exported.\nA regex can be provided to select multiple types with similar or matching schema ids (eg /schema(0-9)\\.json/).\nA single --schemaId option may be given to export a single content type.\nMultiple --schemaId options may be given to export multiple content types at the same time.',
      requiresArg: true
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'Overwrite content types without asking.'
    })
    .option('archived', {
      type: 'boolean',
      describe: 'If present, archived content types will also be considered.',
      boolean: true
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: createLog
    });
};

const equals = (a: ContentType, b: ContentType): boolean =>
  a.contentTypeUri === b.contentTypeUri && isEqual(a.settings, b.settings);

interface ContentTypeWithRepositories extends ContentType {
  repositories?: string[];
}

interface ExportRecord {
  readonly filename: string;
  readonly status: ExportResult;
  readonly contentType: ContentTypeWithRepositories;
}

export const filterContentTypesByUri = (listToFilter: ContentType[], contentTypeUriList: string[]): ContentType[] => {
  if (contentTypeUriList.length === 0) {
    return listToFilter;
  }

  const unmatchedContentTypeUriList: string[] = contentTypeUriList.filter(
    match => !listToFilter.some(contentType => equalsOrRegex(contentType.contentTypeUri as string, match))
  );
  if (unmatchedContentTypeUriList.length > 0) {
    throw new Error(
      `The following schema ID(s) could not be found: [${unmatchedContentTypeUriList
        .map(u => `'${u}'`)
        .join(', ')}].\nNothing was exported, exiting.`
    );
  }

  return listToFilter.filter(contentType =>
    contentTypeUriList.some(match => equalsOrRegex(contentType.contentTypeUri as string, match))
  );
};

export const getReposNamesForContentType = (
  repositories: ContentRepository[] = [],
  contentType: ContentType
): string[] => {
  return compact(
    repositories
      .filter(
        repo =>
          repo.contentTypes &&
          repo.contentTypes.find(
            el => el.hubContentTypeId === contentType.id && el.contentTypeUri === contentType.contentTypeUri
          )
      )
      .map(repo => repo.name || '')
  );
};

export const getExportRecordForContentType = (
  contentType: ContentTypeWithRepositories,
  outputDir: string,
  previouslyExportedContentTypes: { [filename: string]: ContentType },
  repositories?: ContentRepository[]
): ExportRecord => {
  const indexOfExportedContentType = Object.values(previouslyExportedContentTypes).findIndex(
    c => c.contentTypeUri === contentType.contentTypeUri
  );
  contentType.repositories = getReposNamesForContentType(repositories, contentType);

  if (indexOfExportedContentType < 0) {
    const filename = uniqueFilename(
      outputDir,
      contentType.contentTypeUri,
      'json',
      Object.keys(previouslyExportedContentTypes)
    );

    // This filename is now used.
    previouslyExportedContentTypes[filename] = contentType;

    return {
      filename: filename,
      status: 'CREATED',
      contentType
    };
  }
  const filename = Object.keys(previouslyExportedContentTypes)[indexOfExportedContentType];
  const previouslyExportedContentType = Object.values(previouslyExportedContentTypes)[indexOfExportedContentType];
  if (equals(previouslyExportedContentType, contentType)) {
    return { filename, status: 'UP-TO-DATE', contentType };
  }
  return {
    filename,
    status: 'UPDATED',
    contentType
  };
};

type ExportsMap = {
  uri: string;
  filename: string;
};

export const getContentTypeExports = (
  outputDir: string,
  previouslyExportedContentTypes: { [filename: string]: ContentType },
  contentTypesBeingExported: ContentType[],
  repositories?: ContentRepository[]
): [ExportRecord[], ExportsMap[]] => {
  const allExports: ExportRecord[] = [];
  const updatedExportsMap: ExportsMap[] = []; // uri x filename
  for (const contentType of contentTypesBeingExported) {
    if (!contentType.contentTypeUri) {
      continue;
    }

    const exportRecord = getExportRecordForContentType(
      contentType,
      outputDir,
      previouslyExportedContentTypes,
      repositories
    );

    allExports.push(exportRecord);

    if (exportRecord.status === 'UPDATED') {
      updatedExportsMap.push({ uri: contentType.contentTypeUri, filename: exportRecord.filename });
    }
  }
  return [allExports, updatedExportsMap];
};

export const processContentTypes = async (
  outputDir: string,
  previouslyExportedContentTypes: { [filename: string]: ContentType },
  contentTypesBeingExported: ContentType[],
  repositories: ContentRepository[] | undefined,
  log: FileLog,
  force: boolean
): Promise<void> => {
  if (contentTypesBeingExported.length === 0) {
    nothingExportedExit(log, 'No content types to export from this hub, exiting.');
    return;
  }

  const [allExports, updatedExportsMap] = getContentTypeExports(
    outputDir,
    previouslyExportedContentTypes,
    contentTypesBeingExported,
    repositories
  );
  if (
    allExports.length === 0 ||
    (Object.keys(updatedExportsMap).length > 0 && !(force || (await promptToOverwriteExports(updatedExportsMap, log))))
  ) {
    nothingExportedExit(log);
    return;
  }

  await ensureDirectoryExists(outputDir);

  const progress = progressBar(allExports.length, 0, { title: 'Exporting content types' });

  const data: [string, string, string][] = [[chalk.bold('File'), chalk.bold('Schema ID'), chalk.bold('Result')]];
  for (const { filename, status, contentType } of allExports) {
    if (status !== 'UP-TO-DATE') {
      delete contentType.id; // do not export id
      writeJsonToFile(filename, contentType);
    }
    data.push([filename, contentType.contentTypeUri || '', status]);
    progress.increment();
  }
  progress.stop();
  log.appendLine(table(data, streamTableOptions));
};

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, schemaId, logFile, force } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = logFile.open();
  const repositories = (await paginator(hub.related.contentRepositories.list)) || [];

  const previouslyExportedContentTypes = loadJsonFromDirectory<ContentType>(dir, ContentType);
  validateNoDuplicateContentTypeUris(previouslyExportedContentTypes);

  const storedContentTypes = await paginateWithProgress(
    hub.related.contentTypes.list,
    { status: Status.ACTIVE },
    { title: 'Retrieving active content types' }
  );
  if (argv.archived) {
    const archivedContentTypes = await paginateWithProgress(
      hub.related.contentTypes.list,
      { status: Status.ARCHIVED },
      { title: 'Retrieving archived content types' }
    );
    Array.prototype.push.apply(storedContentTypes, archivedContentTypes);
  }
  const schemaIdArray: string[] = schemaId ? (Array.isArray(schemaId) ? schemaId : [schemaId]) : [];
  const filteredContentTypes = filterContentTypesByUri(storedContentTypes, schemaIdArray);
  await processContentTypes(
    dir,
    previouslyExportedContentTypes,
    filteredContentTypes,
    repositories,
    log,
    force || false
  );

  await log.close();
};
