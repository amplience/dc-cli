import Yargs from 'yargs/yargs';
import YargsCommandBuilderOptions from './common/yargs/yargs-command-builder-options';
import { configureCommandOptions, readConfigFile } from './commands/configure';
import { Arguments, Argv } from 'yargs';

export const displayError = (err: { message: string } | string | Error): void => {
  let message = '';
  if (typeof err === 'string') {
    message = `Error: ${err}`;
  } else if (err instanceof Error || err.message) {
    message = `Error: ${err.message}`;
  }
  console.error(message);
};

const configureYargs = (yargInstance: Argv): Promise<Arguments> => {
  return new Promise(
    async (resolve, reject): Promise<void> => {
      let failInvoked = false;
      const failFn = (msg: string, err?: object | string): void => {
        if (failInvoked) {
          return;
        }
        failInvoked = true;
        if (msg && !err) {
          yargInstance.showHelp('error');
        }
        reject(err || msg);
      };
      const argv = await yargInstance
        .options(configureCommandOptions)
        .config('config', readConfigFile)
        .commandDir('./commands', YargsCommandBuilderOptions)
        .strict()
        .demandCommand(1, 'Please specify at least one command')
        .exitProcess(false)
        .showHelpOnFail(false)
        .fail(failFn).argv;
      resolve(argv);
    }
  );
};

export default async (yargInstance = Yargs(process.argv.slice(2))): Promise<Arguments | void> => {
  return await configureYargs(yargInstance).catch(displayError);
};
