import { createLog, getDefaultLogPath, openRevertLog } from '../../common/log-helpers';
import { Argv, Arguments } from 'yargs';
import { join } from 'path';
import { ConfigurationParameters } from '../configure';

import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { CloneHubBuilderOptions } from '../../interfaces/clone-hub-builder-options';

import { ContentCloneStep } from './steps/content-clone-step';
import { SchemaCloneStep } from './steps/schema-clone-step';
import { SettingsCloneStep } from './steps/settings-clone-step';
import { TypeCloneStep } from './steps/type-clone-step';
import { IndexCloneStep } from './steps/index-clone-step';
import { CloneHubState } from './model/clone-hub-state';
import { LogErrorLevel } from '../../common/archive/archive-log';
import { ExtensionCloneStep } from './steps/extension-clone-step';

export function getDefaultMappingPath(name: string, platform: string = process.platform): string {
  return join(
    process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname,
    '.amplience',
    `clone/`,
    `${name}.json`
  );
}

// Temp folder structure:
// hub-*/settings/
// hub-*/extensions/
// hub-*/schemas/
// hub-*/types/
// hub-*/indexes/
// hub-*/content/
// hub-*/events/

export const command = 'clone <dir>';

export const desc =
  'Clone an entire hub. The active account and hub are the source for the copy. Exported data from the source hub will be placed in the specified folder.';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('hub', 'clone', platform);

export const steps = [
  new SettingsCloneStep(),
  new ExtensionCloneStep(),
  new SchemaCloneStep(),
  new TypeCloneStep(),
  new IndexCloneStep(),
  new ContentCloneStep()
];

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe:
        'Directory to export content to, then import from. This must be set to the previous directory for a revert.',
      type: 'string'
    })

    .option('dstHubId', {
      type: 'string',
      describe: 'Destination hub ID. If not specified, it will be the same as the source.'
    })

    .option('dstClientId', {
      type: 'string',
      describe: "Destination account's client ID. If not specified, it will be the same as the source."
    })

    .option('dstSecret', {
      type: 'string',
      describe: "Destination account's secret. Must be used alongside dstClientId."
    })

    .option('mapFile', {
      type: 'string',
      describe:
        'Mapping file to use when updating content that already exists. Updated with any new mappings that are generated. If not present, will be created.'
    })

    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe:
        'Overwrite content, create and assign content types, and ignore content with missing types/references without asking.'
    })

    .alias('v', 'validate')
    .option('v', {
      type: 'boolean',
      boolean: true,
      describe: 'Only recreate folder structure - content is validated but not imported.'
    })

    .option('skipIncomplete', {
      type: 'boolean',
      boolean: true,
      describe: 'Skip any content item that has one or more missing dependancy.'
    })

    .option('lastPublish', {
      type: 'boolean',
      boolean: true,
      describe: 'When available, export the last published version of a content item rather than its newest version.'
    })

    .option('publish', {
      type: 'boolean',
      boolean: true,
      describe:
        'Publish any content items that either made a new version on import, or were published more recently in the JSON.'
    })

    .option('republish', {
      type: 'boolean',
      boolean: true,
      describe: 'Republish content items regardless of whether the import changed them or not. (--publish not required)'
    })

    .option('excludeKeys', {
      type: 'boolean',
      boolean: true,
      describe: 'Exclude delivery keys when importing content items.'
    })

    .option('media', {
      type: 'boolean',
      boolean: true,
      describe:
        "Detect and rewrite media links to match assets in the target account's DAM. Your client must have DAM permissions configured."
    })

    .option('revertLog', {
      type: 'string',
      describe:
        'Revert a previous clone using a given revert log and given directory. Reverts steps in reverse order, starting at the specified one.',
      coerce: openRevertLog
    })

    .option('step', {
      type: 'string',
      describe: 'Start at a specific step. Steps after the one you specify will also run.',
      choices: steps.map(step => step.getId())
    })

    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: createLog
    });
};

export const handler = async (argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const log = argv.logFile.open();
  const tempFolder = argv.dir;

  if (argv.mapFile == null) {
    argv.mapFile = getDefaultMappingPath(`hub-${argv.dstHubId}`);
  }

  const { hubId, clientId, clientSecret } = argv;

  const dstHubId = argv.dstHubId || hubId;
  const dstClientId = argv.dstClientId || clientId;
  const dstSecret = argv.dstSecret || clientSecret;

  const argvCore = {
    $0: argv.$0,
    _: argv._
  };

  const state: CloneHubState = {
    argv: argv,
    from: {
      clientId: clientId,
      clientSecret: clientSecret,
      hubId: hubId,
      ...argvCore
    },
    to: {
      clientId: dstClientId,
      clientSecret: dstSecret,
      hubId: dstHubId,
      ...argvCore
    },
    path: tempFolder,
    logFile: log
  };

  await ensureDirectoryExists(tempFolder);

  // Steps system: Each step performs another part of the clone command.
  // If a step fails, we can return to that step on a future attempt.

  const revertLog = await argv.revertLog;

  const stepIndex = Math.max(0, steps.findIndex(step => step.getId() === argv.step));

  if (revertLog) {
    if (revertLog.errorLevel === LogErrorLevel.INVALID) {
      log.error('Could not read the revert log.');
      await log.close();
      return;
    }

    state.revertLog = revertLog;

    for (let i = stepIndex; i < steps.length; i++) {
      const step = steps[i];

      log.switchGroup(step.getName());
      revertLog.switchGroup(step.getName());
      log.appendLine(`=== Reverting Step ${i} - ${step.getName()} ===`);

      const success = await step.revert(state);

      if (!success) {
        log.appendLine(`Reverting step ${i} ('${step.getId()}': ${step.getName()}) Failed. Terminating.`);
        log.appendLine('');
        log.appendLine('To continue the revert from this point, use the option:');
        log.appendLine(`--step ${step.getId()}`);

        break;
      }
    }
  } else {
    for (let i = stepIndex; i < steps.length; i++) {
      const step = steps[i];

      log.switchGroup(step.getName());
      log.appendLine(`=== Running Step ${i} - ${step.getName()} ===`);

      const success = await step.run(state);

      if (!success) {
        log.appendLine(`Step ${i} ('${step.getId()}': ${step.getName()}) Failed. Terminating.`);
        log.appendLine('');
        log.appendLine('To continue the clone from this point, use the option:');
        log.appendLine(`--step ${step.getId()}`);

        break;
      }
    }
  }

  await log.close();
};
