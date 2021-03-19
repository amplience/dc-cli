import { getDefaultLogPath } from '../../common/log-helpers';
import { Argv, Arguments } from 'yargs';
import { ConfigurationParameters } from '../configure';

import { FileLog } from '../../common/file-log';

import { CleanHubBuilderOptions } from '../../interfaces/clean-hub-builder-options';
import { SchemaCleanStep } from './steps/schema-clean-step';
import { TypeCleanStep } from './steps/type-clean-step';
import { ContentCleanStep } from './steps/content-clean-step';

export const command = 'clean';

export const desc =
  'Cleans an entire hub. This will archive all content items, types and schemas. Note that these are not fully deleted, but they can be resurrected by a future import.';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('hub', 'clean', platform);

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
      describe: 'Path to a log file to write to.'
    })

    .option('step', {
      type: 'number',
      describe: 'Start at a numbered step. 0: Schema, 1: Type, 2: Content'
    });
};

const steps = [new ContentCleanStep(), new TypeCleanStep(), new SchemaCleanStep()];

export const handler = async (argv: Arguments<CleanHubBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const logFile = argv.logFile;
  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;

  argv.logFile = log;

  // Steps system: Each step performs another part of the clean command.
  // If a step fails, we can return to that step on a future attempt.

  for (let i = argv.step || 0; i < steps.length; i++) {
    const step = steps[i];

    log.appendLine(`=== Running Step ${i} - ${step.getName()} ===`);

    const success = await step.run(argv);

    if (!success) {
      log.appendLine(`Step ${i} (${step.getName()}) Failed. Terminating.`);
      log.appendLine('');
      log.appendLine('To continue the clean from this point, use the option:');
      log.appendLine(`--step ${i}`);

      break;
    }
  }

  if (typeof logFile !== 'object') {
    await log.close();
  }
};
