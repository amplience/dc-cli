import { Arguments, Argv } from 'yargs';
import { FileLog } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { filterExtensionsById } from './export';
import { nothingExportedExit as nothingToDeleteExit } from '../../services/export.service';
import { Extension } from 'dc-management-sdk-js';
import { asyncQuestion } from '../../common/question-helpers';

export const command = 'delete [id]';

export const desc = 'Delete Extensions';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('extension', 'delete', platform);

export const coerceLog = (logFile: string): FileLog => createLog(logFile, 'Extensions Delete Log');

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe:
        'The ID of a the extension to be deleted. If id is not provided, this command will delete ALL extensions in the hub.'
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, there will be no confirmation prompt before deleting the found extensions.'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: coerceLog
    });
};

export const processExtensions = async (
  extensionsToDelete: Extension[],
  allExtensions: boolean,
  logFile: FileLog,
  force?: boolean
): Promise<void> => {
  const failedExtensions: Extension[] = [];

  const log = logFile.open();

  if (extensionsToDelete.length === 0) {
    nothingToDeleteExit(log, 'No extensions to delete from this hub, exiting.');
    return;
  }

  if (!force) {
    const yes = await asyncQuestion(
      allExtensions
        ? `Providing no ID/s will delete ALL extensions! Are you sure you want to do this? (Y/n)\n`
        : `${extensionsToDelete.length} extensions will be deleted. Would you like to continue? (Y/n)\n`
    );
    if (!yes) {
      return;
    }
  }

  log.appendLine(`Deleting ${extensionsToDelete.length} extensions.`);

  for (const [i, extension] of extensionsToDelete.entries()) {
    try {
      await extension.related.delete();
      log.appendLine(`Successfully deleted "${extension.label}"`);
    } catch (e) {
      failedExtensions.push(extension);
      extensionsToDelete.splice(i, 1);
      log.appendLine(`Failed to delete ${extension.label}: ${e.toString()}`);
    }
  }

  log.appendLine(`Finished successfully deleting ${extensionsToDelete.length} extensions`);

  if (failedExtensions.length > 0) {
    log.appendLine(`Failed to delete ${failedExtensions.length} extensions`);
  }

  log.appendLine(`Extension deletion complete`);

  await log.close();
};

export const handler = async (
  argv: Arguments<Pick<ExportBuilderOptions, 'logFile' | 'force'> & ConfigurationParameters>
): Promise<void> => {
  const { id, logFile, force } = argv;

  const client = dynamicContentClientFactory(argv);

  const allExtensions = !id;

  const hub = await client.hubs.get(argv.hubId);

  const storedExtensions = await paginator(hub.related.extensions.list);

  const idArray: string[] = id ? (Array.isArray(id) ? id : [id]) : [];
  const filteredExtensions = filterExtensionsById(storedExtensions, idArray);
  await processExtensions(filteredExtensions, allExtensions, logFile, force || false);
};
