import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { Argv, Arguments } from 'yargs';
import { ConfigurationParameters } from '../configure';

import { CleanHubBuilderOptions } from '../../interfaces/clean-hub-builder-options';
import { SchemaCleanStep } from './steps/schema-clean-step';
import { TypeCleanStep } from './steps/type-clean-step';
import { ContentCleanStep } from './steps/content-clean-step';

export const command = 'clean';

export const desc =
  'Cleans an entire hub. This will archive all content items, types and schemas. Note that these are not fully deleted, but they can be resurrected by a future import.';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('hub', 'clean', platform);

export const steps = [new ContentCleanStep(), new TypeCleanStep(), new SchemaCleanStep()];

export const builder = (yargs: Argv): void => {
  yargs
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe:
        'Overwrite content, create and assign content types, and ignore content with missing types/references without asking.'
    })

    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: createLog
    })

    .option('step', {
      type: 'string',
      describe: 'Start at a specific step. Steps after the one you specify will also run.',
      choices: steps.map(step => step.getId())
    });
};

export const handler = async (argv: Arguments<CleanHubBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const log = argv.logFile.open();

  argv.logFile = log;

  // Steps system: Each step performs another part of the clean command.
  // If a step fails, we can return to that step on a future attempt.

  const stepIndex = Math.max(0, steps.findIndex(step => step.getId() === argv.step));

  for (let i = stepIndex; i < steps.length; i++) {
    const step = steps[i];

    log.switchGroup(step.getName());
    log.appendLine(`=== Running Step ${i} - ${step.getName()} ===`);

    const success = await step.run(argv);

    if (!success) {
      log.appendLine(`Step ${i} ('${step.getId()}': ${step.getName()}) Failed. Terminating.`);
      log.appendLine('');
      log.appendLine('To continue the clean from this point, use the option:');
      log.appendLine(`--step ${step.getId()}`);

      break;
    }
  }

  await log.close();
};
