import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { WorkflowState, Settings } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ImportSettingsBuilderOptions } from '../../interfaces/import-settings-builder-options.interface';
import { WorkflowStatesMapping } from '../../common/workflowStates/workflowStates-mapping';
import { FileLog } from '../../common/file-log';
import { getDefaultLogPath, asyncQuestion } from '../../common/log-helpers';
import { join } from 'path';
import { readFile } from 'fs';
import { promisify } from 'util';
import { uniq, uniqBy } from 'lodash';

export type Answer = {
  answer?: string[];
};

export const command = 'import <filePath>';

export const desc = 'Import Settings';

export function getDefaultMappingPath(name: string, platform: string = process.platform): string {
  return join(
    process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname,
    '.amplience',
    `imports/`,
    `${name}.json`
  );
}

const trySaveMapping = async (
  mapFile: string | undefined,
  mapping: WorkflowStatesMapping,
  log: FileLog
): Promise<void> => {
  if (mapFile != null) {
    try {
      await mapping.save(mapFile);
    } catch (e) {
      log.appendLine(`Failed to save the mapping. ${e.toString()}`);
    }
  }
};

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('settings', 'import', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('filePath', {
      describe: 'Source file path containing Settings definition',
      type: 'string'
    })
    .option('mapFile', {
      type: 'string',
      requiresArg: false,
      describe:
        'Mapping file to use when updating workflow states that already exists. Updated with any new mappings that are generated. If not present, will be created.'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.'
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'Overwrite workflow states without asking.'
    });
};

export const handler = async (
  argv: Arguments<ImportSettingsBuilderOptions & ConfigurationParameters & Answer>
): Promise<void> => {
  const { filePath: sourceFile, logFile, force, answer = true } = argv;
  let { mapFile } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;
  const mapping = new WorkflowStatesMapping();
  let uniqueLocales = [];
  let uniqueApplications = [];

  try {
    if (mapFile == null) {
      mapFile = getDefaultMappingPath(`workflow-states-${hub.id}`);
    }

    if (await mapping.load(mapFile)) {
      log.appendLine(`Existing mapping loaded from '${mapFile}', changes will be saved back to it. \n`);
    } else {
      log.appendLine(`Creating new mapping file at '${mapFile}'. \n`);
    }

    const exportedSettings = await promisify(readFile)(sourceFile, { encoding: 'utf8' });
    const settingsJson = JSON.parse(exportedSettings);

    const { settings } = settingsJson;
    let { workflowStates } = settingsJson;

    if (hub.settings && hub.settings.localization && hub.settings.localization.locales) {
      uniqueLocales = uniq([...hub.settings.localization.locales, ...settings.localization.locales]);
    }

    if (hub.settings && hub.settings.applications) {
      uniqueApplications = uniqBy([...hub.settings.applications, ...settings.applications], 'name');
    }

    await hub.related.settings.update(
      new Settings({
        devices: settings.devices,
        applications: uniqueApplications,
        localization: {
          locales: uniqueLocales
        }
      })
    );

    log.appendLine('Settings Updated! \n');

    const alreadyExists = workflowStates.filter((item: WorkflowState) => mapping.getWorkflowState(item.id) != null);

    if (alreadyExists.length > 0) {
      const question = !force
        ? await asyncQuestion(
            `${alreadyExists.length} of the workflow states being imported already exist in the mapping. Would you like to update these workflow states instead of skipping them? (y/n) `,
            log
          )
        : answer;

      const updateExisting = question || force;

      if (!updateExisting) {
        workflowStates = workflowStates.filter((item: WorkflowState) => mapping.getWorkflowState(item.id) == null);
      }
    }
    await Promise.all(
      workflowStates.map(async (item: WorkflowState) => {
        const exists = mapping.getWorkflowState(item.id);

        if (exists) {
          const state = await client.workflowStates.get(exists);

          await state.related.update(
            new WorkflowState({
              label: item.label,
              color: item.color
            })
          );

          log.addAction('UPDATE', exists);
        } else {
          const newItem = await hub.related.workflowStates.create(
            new WorkflowState({
              label: item.label,
              color: item.color
            })
          );

          log.addAction('CREATE', newItem.id || '');

          mapping.registerWorkflowState(item.id as string, newItem.id as string);
        }
      })
    );

    log.appendLine('Done!');

    await trySaveMapping(mapFile, mapping, log);

    if (typeof logFile !== 'object') {
      // Only close the log if it was opened by this handler.
      await log.close();
    }

    process.stdout.write('\n');
  } catch (e) {
    console.log(e);
  }
};
