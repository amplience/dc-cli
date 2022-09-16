import { Argv } from 'yargs';
import { readConfig } from '../cli';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import { configureCommandOptions } from './configure';

export const command = 'search-index';

export const desc = 'Search Index';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('search-index', YargsCommandBuilderOptions)
    .options(configureCommandOptions)
    .config('config', readConfig)
    .demandCommand()
    .help();

export const handler = (): void => {
  /* do nothing */
};
