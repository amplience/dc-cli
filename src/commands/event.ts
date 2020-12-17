import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'event';

export const desc = 'Event';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('event', YargsCommandBuilderOptions)
    .demandCommand()
    .help();
