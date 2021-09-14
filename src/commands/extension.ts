import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'extension';

export const desc = 'Extension';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('extension', YargsCommandBuilderOptions)
    .demandCommand()
    .help();
