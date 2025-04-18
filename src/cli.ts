import Yargs from 'yargs/yargs';
import YargsCommandBuilderOptions from './common/yargs/yargs-command-builder-options';
import { readConfigFile } from './commands/configure';
import { Arguments, Argv } from 'yargs';
import errorHandler from './error-handler';

export const readConfig = (configFile: string): object => {
  return readConfigFile(configFile, process.argv[2] === 'configure');
};

const configureYargs = (yargInstance: Argv): Promise<Arguments> => {
  return new Promise(async (resolve): Promise<void> => {
    let failInvoked = false;
    const isYError = (err?: Error | string): boolean => err instanceof Error && err.name === 'YError';
    const failFn = (msg: string, err?: Error | string): void => {
      // fail should only be invoked once
      if (failInvoked) {
        return;
      }
      failInvoked = true;
      if ((msg && !err) || isYError(err)) {
        yargInstance.showHelp('error');
      }
      errorHandler(err || msg);
    };
    const argv = await yargInstance
      .scriptName('dc-cli')
      .commandDir('./commands', YargsCommandBuilderOptions)
      .strict()
      .demandCommand(1, 'Please specify at least one command')
      .exitProcess(false)
      .showHelpOnFail(false)
      .fail(failFn).argv;
    resolve(argv);
  });
};

export default async (yargInstance = Yargs(process.argv.slice(2))): Promise<Arguments | void> => {
  return await configureYargs(yargInstance);
};
