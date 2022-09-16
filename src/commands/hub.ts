import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import ConfigManager from '../common/hub-manager';
import { CommandOptions } from '../interfaces/command-options.interface';

export const command = 'hub';
export const desc = 'Hub';

const commandOptions: CommandOptions = {
  clientId: { type: 'string' },
  clientSecret: { type: 'string' },
  hubId: { type: 'string' }
};

export const hubBuilder = (yargs: Argv): Argv =>
  yargs.positional('hub', {
    describe: 'hub name',
    type: 'string',
    demandOption: false,

    // novadev-694 provide a default value so we don't choke and can present the selection list
    default: ''
  });

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('hub', YargsCommandBuilderOptions)
    .demandCommand()
    .command('add', 'Add hub', commandOptions, ConfigManager.addHub)
    .command('list', 'List hubs', ConfigManager.listHubs)
    .command('ls', 'List hubs', ConfigManager.listHubs)
    .command('use [hub]', 'Use hub', hubBuilder, ConfigManager.useHub)
    .help();
