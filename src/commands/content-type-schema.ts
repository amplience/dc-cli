import { Argv } from 'yargs';
import { readConfig } from '../cli';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import { configureCommandOptions } from './configure';

export const command = 'content-type-schema';

export const desc = 'Content Type Schema';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('content-type-schema', YargsCommandBuilderOptions)
    .options(configureCommandOptions)
    .config('config', readConfig)
    .demandCommand()
    .help();

export const handler = (): void => {
  /* do nothing */
};
