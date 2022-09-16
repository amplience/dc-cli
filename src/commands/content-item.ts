import { Argv } from 'yargs';
import { readConfig } from '../cli';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import { configureCommandOptions } from './configure';

export const command = 'content-item';

export const desc = 'Content Item';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('content-item', YargsCommandBuilderOptions)
    .options(configureCommandOptions)
    .config('config', readConfig)
    .demandCommand()
    .help();

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const handler = (): void => {};
