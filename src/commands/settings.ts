import { Argv } from 'yargs';
import { readConfig } from '../cli';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import { configureCommandOptions } from './configure';

export const command = 'settings';

export const desc = 'Settings';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('settings', YargsCommandBuilderOptions)
    .options(configureCommandOptions)
    .config('config', readConfig)
    .demandCommand()
    .help();
