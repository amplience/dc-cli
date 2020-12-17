import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'settings';

export const desc = 'Settings';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('settings', YargsCommandBuilderOptions)
    .demandCommand()
    .help();
