import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'content-type';

export const desc = 'Content Type';

export const builder = (yargs: Argv): Argv => yargs.commandDir('content-type', YargsCommandBuilderOptions);

export const handler = (): void => {};
