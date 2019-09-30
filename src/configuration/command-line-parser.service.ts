import yargs from 'yargs';
import { Arguments } from 'yargs';
import fs from 'fs';
import { join } from 'path';
import { CommandOptions } from '../interfaces/command-options.interface';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export type GlobalConfigurationParameters = {
  key: string;
  secret: string;
  hub: string;
};

export const globalCommandOptions: CommandOptions = {
  key: { type: 'string', demandOption: true },
  secret: { type: 'string', demandOption: true },
  hub: { type: 'string', demandOption: true }
};

interface CommandLineParser<T> {
  parse(args: string | string[]): Arguments;

  storeGlobal(jsonObj: T): void;
}

function getUserHome(): string {
  return process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname;
}

export const GLOBALCONFIG_FILENAME = join(getUserHome(), '.amplience', 'dc-cli-config.json');

export default class CommandLineParserService implements CommandLineParser<GlobalConfigurationParameters> {
  constructor(private readonly yargsInstance: yargs.Argv = yargs) {}

  public parse(args: string | string[] = process.argv.slice(2)): Arguments {
    let globalConfig: object = {};
    if (fs.existsSync(GLOBALCONFIG_FILENAME)) {
      globalConfig = JSON.parse(fs.readFileSync(GLOBALCONFIG_FILENAME, 'utf-8'));
    }
    return this.yargsInstance
      .config(globalConfig)
      .options(globalCommandOptions)
      .command(
        'configure',
        'Saves the configuration options to a file',
        globalCommandOptions,
        (argv: Arguments<GlobalConfigurationParameters>) => {
          console.log(argv);
          const { hub, key, secret } = argv;
          this.storeGlobal({
            hub,
            key,
            secret
          });
        }
      )
      .commandDir('../commands', YargsCommandBuilderOptions)
      .demandCommand()
      .parse(args);
  }

  public storeGlobal(jsonObj: GlobalConfigurationParameters): void {
    fs.writeFile(GLOBALCONFIG_FILENAME, JSON.stringify(jsonObj), (err: Error) => {
      if (err) {
        console.error(err.message);
      }
    });
  }
}
