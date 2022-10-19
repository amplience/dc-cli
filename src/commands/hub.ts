import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import HubManager from '../common/hub-manager';
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

    default: ''
  });

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('hub', YargsCommandBuilderOptions)
    .demandCommand()
    .command('add', 'Add hub', commandOptions, HubManager.addHub)
    .command('list', 'List hubs', HubManager.listHubs)
    .command('ls', 'List hubs', HubManager.listHubs)
    .command('use [hub]', 'Use hub', hubBuilder, HubManager.useHub)
    .help();
