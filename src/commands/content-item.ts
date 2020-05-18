import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'content-item';

export const desc = 'Content Item';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('content-item', YargsCommandBuilderOptions)
    .demandCommand()
    .help();

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const handler = (): void => {};
