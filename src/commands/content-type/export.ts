import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentType } from 'dc-management-sdk-js';
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
import { isEqual } from 'lodash';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { FileLog } from '../../common/file-log';
import { getDefaultLogPath } from '../../common/log-helpers';
import { Status } from '../../common/dc-management-sdk-js/resource-status';

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
        'The Schema ID of a Content Type to be exported.\nIf no --schemaId option is given, all content types for the hub are exported.\nA single --schemaId option may be given to export a single content type.\nMultiple --schemaId options may be given to export multiple content types at the same time.',
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
      describe: 'Path to a log file to write to.'
    });
};

const equals = (a: ContentType, b: ContentType): boolean =>
  a.contentTypeUri === b.contentTypeUri && isEqual(a.settings, b.settings);

interface ExportRecord {
  readonly filename: string;
  readonly status: ExportResult;
  readonly contentType: ContentType;
}

export const filterContentTypesByUri = (listToFilter: ContentType[], contentTypeUriList: string[]): ContentType[] => {
  if (contentTypeUriList.length === 0) {
    return listToFilter;
  }

  const unmatchedContentTypeUriList: string[] = contentTypeUriList.filter(
    uri => !listToFilter.some(contentType => contentType.contentTypeUri === uri)
  );
  if (unmatchedContentTypeUriList.length > 0) {
    throw new Error(
      `The following schema ID(s) could not be found: [${unmatchedContentTypeUriList
        .map(u => `'${u}'`)
        .join(', ')}].\nNothing was exported, exiting.`
    );
  }

  return listToFilter.filter(contentType => contentTypeUriList.some(uri => contentType.contentTypeUri === uri));
};

export const getExportRecordForContentType = (
  contentType: ContentType,
  outputDir: string,
  previouslyExportedContentTypes: { [filename: string]: ContentType }
): ExportRecord => {
  const indexOfExportedContentType = Object.values(previouslyExportedContentTypes).findIndex(
    c => c.contentTypeUri === contentType.contentTypeUri
  );
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
  contentTypesBeingExported: ContentType[]
): [ExportRecord[], ExportsMap[]] => {
  const allExports: ExportRecord[] = [];
  const updatedExportsMap: ExportsMap[] = []; // uri x filename
  for (const contentType of contentTypesBeingExported) {
    if (!contentType.contentTypeUri) {
      continue;
    }

    const exportRecord = getExportRecordForContentType(contentType, outputDir, previouslyExportedContentTypes);
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
  log: FileLog,
  force: boolean
): Promise<void> => {
  if (contentTypesBeingExported.length === 0) {
    nothingExportedExit(log, 'No content types to export from this hub, exiting.');
  }

  const [allExports, updatedExportsMap] = getContentTypeExports(
    outputDir,
    previouslyExportedContentTypes,
    contentTypesBeingExported
  );
  if (
    allExports.length === 0 ||
    (Object.keys(updatedExportsMap).length > 0 && !(force || (await promptToOverwriteExports(updatedExportsMap, log))))
  ) {
    nothingExportedExit(log);
  }

  await ensureDirectoryExists(outputDir);

  const data: string[][] = [];

  data.push([chalk.bold('File'), chalk.bold('Schema ID'), chalk.bold('Result')]);
  for (const { filename, status, contentType } of allExports) {
    if (status !== 'UP-TO-DATE') {
      delete contentType.id; // do not export id
      writeJsonToFile(filename, contentType);
    }
    data.push([filename, contentType.contentTypeUri || '', status]);
  }

  log.appendLine(table(data, streamTableOptions));
};

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, schemaId, logFile, force } = argv;

  const previouslyExportedContentTypes = loadJsonFromDirectory<ContentType>(dir, ContentType);
  validateNoDuplicateContentTypeUris(previouslyExportedContentTypes);

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;
  const storedContentTypes = await paginator(hub.related.contentTypes.list, { status: Status.ACTIVE });
  if (argv.archived) {
    const archivedContentTypes = await paginator(hub.related.contentTypes.list, { status: Status.ARCHIVED });
    Array.prototype.push.apply(storedContentTypes, archivedContentTypes);
  }
  const schemaIdArray: string[] = schemaId ? (Array.isArray(schemaId) ? schemaId : [schemaId]) : [];
  const filteredContentTypes = filterContentTypesByUri(storedContentTypes, schemaIdArray);
  await processContentTypes(dir, previouslyExportedContentTypes, filteredContentTypes, log, force || false);

  if (typeof logFile !== 'object') {
    // Only close the log if it was opened by this handler.
    await log.close();
  }
};
