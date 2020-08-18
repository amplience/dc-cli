import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'content-repository';

export const desc = 'Content Repository';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('content-repository', YargsCommandBuilderOptions)
    .demandCommand()
    .help();

export const handler = (): void => {
  /* do nothing */
};
