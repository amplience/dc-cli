import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import ConfigManager from '../common/config-manager';

export const command = 'hub';
export const desc = 'Hub';

export const hubBuilder = (yargs: Argv): Argv =>
  yargs.positional('hub', {
    describe: 'hub name',
    type: 'string',
    demandOption: false
  });

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('hub', YargsCommandBuilderOptions)
    .demandCommand()
    .command('add', 'Add hub', ConfigManager.addHub)
    .command('list', 'List hubs', ConfigManager.listHubs)
    .command('ls', 'List hubs', ConfigManager.listHubs)
    .command('use [hub]', 'Use hub', hubBuilder, ConfigManager.useHub)
    .help();
