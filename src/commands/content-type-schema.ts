import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'content-type-schema';

export const desc = 'Content Type Schema';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('content-type-schema', YargsCommandBuilderOptions)
    .demandCommand()
    .help();

export const handler = (): void => {
  /* do nothing */
};
