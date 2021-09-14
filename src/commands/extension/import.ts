import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { DynamicContent, Extension, Hub, ValidationLevel } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { table } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { ImportBuilderOptions } from '../../interfaces/import-builder-options.interface';
import chalk from 'chalk';
import { ImportResult, loadJsonFromDirectory, UpdateStatus } from '../../services/import.service';
import { FileLog } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { equals } from './export';

export const command = 'import <dir>';

export const desc = 'Import Extensions';

export interface SchemaOptions {
  validation: ValidationLevel;
}

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('extension', 'import', platform);

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Directory containing Extensions',
    type: 'string'
  });

  yargs.option('logFile', {
    type: 'string',
    default: LOG_FILENAME,
    describe: 'Path to a log file to write to.',
    coerce: createLog
  });
};

type ExtensionName = string;
type ExtensionFile = string;

export const validateNoDuplicateExtensionNames = (importedExtensions: {
  [filename: string]: Extension;
}): void | never => {
  const nameToFilenameMap = new Map<ExtensionName, ExtensionFile[]>(); // map: name x filenames
  for (const [filename, extension] of Object.entries(importedExtensions)) {
    if (extension.name) {
      const otherFilenames: string[] = nameToFilenameMap.get(extension.name) || [];
      if (filename) {
        nameToFilenameMap.set(extension.name, [...otherFilenames, filename]);
      }
    }
  }
  const uniqueDuplicateNames: [string, ExtensionFile[]][] = [];
  nameToFilenameMap.forEach((filenames, name) => {
    if (filenames.length > 1) {
      uniqueDuplicateNames.push([name, filenames]);
    }
  });

  if (uniqueDuplicateNames.length > 0) {
    throw new Error(
      `Extensions must have unique name values. Duplicate values found:-\n${uniqueDuplicateNames
        .map(([name, filenames]) => `  name: '${name}' in files: [${filenames.map(f => `'${f}'`).join(', ')}]`)
        .join('\n')}`
    );
  }
};

export const filterExtensionsById = (
  idFilter: string[],
  importedExtensions: {
    [filename: string]: Extension;
  }
): void | never => {
  for (const [filename, extension] of Object.entries(importedExtensions)) {
    if (idFilter.indexOf(extension.id as string) === -1) {
      delete importedExtensions[filename];
    }
  }
};

export const storedExtensionMapper = (extension: Extension, storedExtensions: Extension[]): Extension => {
  const found = storedExtensions.find(stored => stored.name === extension.name);
  const mutatedExtension = found ? { ...extension, id: found.id } : extension;

  return new Extension(mutatedExtension);
};

export const doCreate = async (hub: Hub, extension: Extension, log: FileLog): Promise<Extension> => {
  try {
    const createdExtension = await hub.related.extensions.create(extension);

    log.addAction('CREATE', `${createdExtension.id}`);

    return createdExtension;
  } catch (err) {
    throw new Error(`Error creating extension ${extension.name}:\n\n${err}`);
  }
};

export const doUpdate = async (
  client: DynamicContent,
  extension: Extension,
  log: FileLog
): Promise<{ extension: Extension; updateStatus: UpdateStatus }> => {
  try {
    const retrievedExtension: Extension = await client.extensions.get(extension.id || '');
    if (equals(retrievedExtension, extension)) {
      return { extension: retrievedExtension, updateStatus: UpdateStatus.SKIPPED };
    }

    const updatedExtension = await retrievedExtension.related.update(extension);

    log.addAction('UPDATE', `${retrievedExtension.id}`);

    return { extension: updatedExtension, updateStatus: UpdateStatus.UPDATED };
  } catch (err) {
    throw new Error(`Error updating extension ${extension.name}: ${err.message}`);
  }
};

export const processExtensions = async (
  extensionsToProcess: Extension[],
  client: DynamicContent,
  hub: Hub,
  log: FileLog
): Promise<void> => {
  const data: string[][] = [];

  data.push([chalk.bold('ID'), chalk.bold('Name'), chalk.bold('Result')]);
  for (const entry of extensionsToProcess) {
    let status: ImportResult;
    let extension: Extension;
    if (entry.id) {
      const result = await doUpdate(client, entry, log);
      extension = result.extension;
      status = result.updateStatus === UpdateStatus.SKIPPED ? 'UP-TO-DATE' : 'UPDATED';
    } else {
      extension = await doCreate(hub, entry, log);
      status = 'CREATED';
    }
    data.push([extension.id || '', extension.name, status]);
  }

  log.appendLine(table(data, streamTableOptions));
};

export const handler = async (
  argv: Arguments<ImportBuilderOptions & ConfigurationParameters>,
  idFilter?: string[]
): Promise<void> => {
  const { dir, logFile } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = logFile.open();
  const extensions = loadJsonFromDirectory<Extension>(dir, Extension);
  if (Object.keys(extensions).length === 0) {
    throw new Error(`No extensions found in ${dir}`);
  }

  validateNoDuplicateExtensionNames(extensions);

  if (idFilter) {
    filterExtensionsById(idFilter, extensions);
  }

  const storedExtensions = await paginator(hub.related.extensions.list);
  const extensionsToProcess = Object.values(extensions).map(extension =>
    storedExtensionMapper(extension, storedExtensions)
  );

  await processExtensions(extensionsToProcess, client, hub, log);

  await log.close();
};
