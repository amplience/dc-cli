import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'content-repositories';

export const desc = 'Content Repositories';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('content-repositories', YargsCommandBuilderOptions)
    .demandCommand()
    .help();

export const handler = (): void => {};
