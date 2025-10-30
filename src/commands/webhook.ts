import { Argv } from 'yargs';
import { readConfig } from '../cli';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import { configureCommandOptions } from './configure';

export const command = 'webhook';

export const desc = 'Webhook';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('webhook', YargsCommandBuilderOptions)
    .options(configureCommandOptions)
    .config('config', readConfig)
    .demandCommand()
    .help();

export const handler = (): void => {};
