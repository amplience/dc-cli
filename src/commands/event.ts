import { Argv } from 'yargs';
import { readConfig } from '../cli';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import { configureCommandOptions } from './configure';

export const command = 'event';

export const desc = 'Event';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('event', YargsCommandBuilderOptions)
    .options(configureCommandOptions)
    .config('config', readConfig)
    .demandCommand()
    .help();
