import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { Hub, Settings, WorkflowState } from 'dc-management-sdk-js';
import { nothingExportedExit, promptToExportSettings, writeJsonToFile } from '../../services/export.service';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import * as path from 'path';
import { FileLog } from '../../common/file-log';

export const command = 'export <dir>';

export const desc = 'Export Hub Settings';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Output directory for the exported Settings',
      type: 'string'
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'Overwrite settings without asking.'
    });
};

export const processSettings = async (
  outputDir: string,
  hubToExport: Hub,
  workflowStates: WorkflowState[],
  log: FileLog,
  force: boolean
): Promise<void> => {
  const { id, name, label, settings = new Settings() } = hubToExport;
  let dir = outputDir;
  if (outputDir.substr(-1) === path.sep) {
    dir = dir.slice(0, -1);
  }
  const file = path.basename(`hub-settings-${id}-${name}`, '.json');

  const uniqueFilename = dir + path.sep + file + '.json';

  if (!(force || (await promptToExportSettings(uniqueFilename, log)))) {
    return nothingExportedExit(log);
  }

  writeJsonToFile(uniqueFilename, {
    id,
    name,
    label,
    settings: {
      devices: settings.devices,
      applications: settings.applications,
      localization: settings.localization
    },
    workflowStates: workflowStates
  });

  log.appendLine('Settings exported successfully!');
};

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, logFile, force } = argv;

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;
  const workflowStates = await paginator(hub.related.workflowStates.list);

  await processSettings(dir, hub, workflowStates, log, force || false);

  if (typeof logFile !== 'object') {
    // Only close the log if it was opened by this handler.
    await log.close();
  }
};
