import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { Extension } from 'dc-management-sdk-js';
import { table } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import chalk from 'chalk';
import {
  ExportResult,
  nothingExportedExit,
  promptToOverwriteExports,
  uniqueFilenamePath,
  writeJsonToFile
} from '../../services/export.service';
import { loadJsonFromDirectory } from '../../services/import.service';
import { isEqual } from 'lodash';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { FileLog } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { validateNoDuplicateExtensionNames } from './import';

export const command = 'export <dir>';

export const desc = 'Export Extensions';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('extension', 'export', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Output directory for the exported Extensions',
      type: 'string'
    })
    .option('id', {
      type: 'string',
      describe:
        'The ID of an Extension to be exported.\nIf no --id option is given, all extensions for the hub are exported.\nA single --id option may be given to export a single extension.\nMultiple --id options may be given to export multiple extensions at the same time.',
      requiresArg: true
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'Overwrite extensions without asking.'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: createLog
    });
};

export const equals = (a: Extension, b: Extension): boolean =>
  a.name === b.name &&
  a.label === b.label &&
  a.height === b.height &&
  a.description === b.description &&
  a.url === b.url &&
  a.status === b.status &&
  isEqual(a.settings, b.settings) &&
  isEqual(a.snippets, b.snippets) &&
  isEqual(a.parameters, b.parameters);

interface ExportRecord {
  readonly filename: string;
  readonly status: ExportResult;
  readonly extension: Extension;
}

export const filterExtensionsById = (listToFilter: Extension[], extensionUriList: string[]): Extension[] => {
  if (extensionUriList.length === 0) {
    return listToFilter;
  }

  const unmatchedExtensionUriList: string[] = extensionUriList.filter(
    id => !listToFilter.some(extension => extension.id === id)
  );
  if (unmatchedExtensionUriList.length > 0) {
    throw new Error(
      `The following extension URI(s) could not be found: [${unmatchedExtensionUriList
        .map(u => `'${u}'`)
        .join(', ')}].\nNothing was exported, exiting.`
    );
  }

  return listToFilter.filter(extension => extensionUriList.some(id => extension.id === id));
};

export const getExportRecordForExtension = (
  extension: Extension,
  outputDir: string,
  previouslyExportedExtensions: { [filename: string]: Extension }
): ExportRecord => {
  const indexOfExportedExtension = Object.values(previouslyExportedExtensions).findIndex(
    c => c.name === extension.name
  );

  if (indexOfExportedExtension < 0) {
    const filename = uniqueFilenamePath(outputDir, extension.name, 'json', Object.keys(previouslyExportedExtensions));

    // This filename is now used.
    previouslyExportedExtensions[filename] = extension;

    return {
      filename: filename,
      status: 'CREATED',
      extension
    };
  }
  const filename = Object.keys(previouslyExportedExtensions)[indexOfExportedExtension];
  const previouslyExportedExtension = Object.values(previouslyExportedExtensions)[indexOfExportedExtension];
  if (equals(previouslyExportedExtension, extension)) {
    return { filename, status: 'UP-TO-DATE', extension };
  }
  return {
    filename,
    status: 'UPDATED',
    extension
  };
};

type ExportsMap = {
  uri: string;
  filename: string;
};

export const getExtensionExports = (
  outputDir: string,
  previouslyExportedExtensions: { [filename: string]: Extension },
  extensionsBeingExported: Extension[]
): [ExportRecord[], ExportsMap[]] => {
  const allExports: ExportRecord[] = [];
  const updatedExportsMap: ExportsMap[] = []; // uri x filename
  for (const extension of extensionsBeingExported) {
    if (!extension.name) {
      continue;
    }

    const exportRecord = getExportRecordForExtension(extension, outputDir, previouslyExportedExtensions);

    allExports.push(exportRecord);

    if (exportRecord.status === 'UPDATED') {
      updatedExportsMap.push({ uri: extension.name, filename: exportRecord.filename });
    }
  }
  return [allExports, updatedExportsMap];
};

export const processExtensions = async (
  outputDir: string,
  previouslyExportedExtensions: { [filename: string]: Extension },
  extensionsBeingExported: Extension[],
  log: FileLog,
  force: boolean
): Promise<void> => {
  if (extensionsBeingExported.length === 0) {
    nothingExportedExit(log, 'No extensions to export from this hub, exiting.');
    return;
  }

  const [allExports, updatedExportsMap] = getExtensionExports(
    outputDir,
    previouslyExportedExtensions,
    extensionsBeingExported
  );
  if (
    allExports.length === 0 ||
    (Object.keys(updatedExportsMap).length > 0 && !(force || (await promptToOverwriteExports(updatedExportsMap, log))))
  ) {
    nothingExportedExit(log);
    return;
  }

  await ensureDirectoryExists(outputDir);

  const data: string[][] = [];

  data.push([chalk.bold('File'), chalk.bold('Name'), chalk.bold('Result')]);
  for (const { filename, status, extension } of allExports) {
    if (status !== 'UP-TO-DATE') {
      delete extension.id; // do not export id
      writeJsonToFile(filename, extension);
    }
    data.push([filename, extension.name, status]);
  }

  log.appendLine(table(data, streamTableOptions));
};

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, id, logFile, force } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = logFile.open();

  const previouslyExportedExtensions = loadJsonFromDirectory<Extension>(dir, Extension);
  validateNoDuplicateExtensionNames(previouslyExportedExtensions);

  const storedExtensions = await paginator(hub.related.extensions.list);

  const idArray: string[] = id ? (Array.isArray(id) ? id : [id]) : [];
  const filteredExtensions = filterExtensionsById(storedExtensions, idArray);
  await processExtensions(dir, previouslyExportedExtensions, filteredExtensions, log, force || false);

  await log.close();
};
