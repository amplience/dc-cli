import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'hub';

export const desc = 'Hub';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('hub', YargsCommandBuilderOptions)
    .demandCommand()
    .help();
