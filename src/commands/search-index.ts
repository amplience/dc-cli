import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'search-index';

export const desc = 'Search Index';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('search-index', YargsCommandBuilderOptions)
    .demandCommand()
    .help();

export const handler = (): void => {
  /* do nothing */
};
