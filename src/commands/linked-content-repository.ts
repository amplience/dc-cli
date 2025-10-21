import { Argv } from 'yargs';
import { readConfig } from '../cli';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import { configureCommandOptions } from './configure';

export const command = 'linked-content-repository';

export const desc = 'Linked Content Repository';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('linked-content-repository', YargsCommandBuilderOptions)
    .options(configureCommandOptions)
    .config('config', readConfig)
    .demandCommand()
    .help();

export const handler = (): void => {
  /* do nothing */
};
