import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { Hub, WorkflowState } from 'dc-management-sdk-js';
import { nothingExportedExit, promptToExportSettings, writeJsonToFile } from '../../services/export.service';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import * as path from 'path';

export const command = 'export <dir>';

export const desc = 'Export Hub Settings';

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Output directory for the exported Settings',
    type: 'string'
  });
};

export const processSettings = async (
  outputDir: string,
  hubToExport: Hub,
  workflowStates: WorkflowState[]
): Promise<void> => {
  const {
    id,
    name,
    label,
    description,
    status,
    settings,
    createdBy,
    createdDate,
    lastModifiedBy,
    lastModifiedDate
  } = hubToExport;
  let dir = outputDir;
  if (outputDir.substr(-1) === path.sep) {
    dir = dir.slice(0, -1);
  }
  const file = path.basename(`settings-${hubToExport.id}`, '.json');

  const uniqueFilename = dir + path.sep + file + '.json';

  if (!(await promptToExportSettings(uniqueFilename))) {
    return nothingExportedExit();
  }

  writeJsonToFile(uniqueFilename, {
    id,
    name,
    label,
    description,
    status,
    settings,
    createdBy,
    createdDate,
    lastModifiedBy,
    lastModifiedDate,
    workflowStates: workflowStates
  });

  process.stdout.write('Settings exported successfully! \n');
};

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const workflowStates = await paginator(hub.related.workflowStates.list);

  await processSettings(dir, hub, workflowStates);
};
