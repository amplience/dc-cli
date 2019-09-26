import * as yargs from 'yargs';
import { Options } from 'yargs';
import * as fs from 'fs';
import { join } from 'path';

type ConfiguartionParameters = { [x: string]: any };

interface GlobalConfigurationParameters extends ConfiguartionParameters {
  key: string | undefined;
  secret: string | undefined;
  hub: string | undefined;
}

interface CommandOptions {
  [key: string]: Options;
}

export const globalCommandOptions: CommandOptions = {
  key: { type: 'string', demandOption: true },
  secret: { type: 'string', demandOption: true },
  hub: { type: 'string', demandOption: true }
};

interface CommandLineParser<Arguments> {
  parse(args: string[], options: CommandOptions): Arguments;
  storeGlobal(jsonObj: GlobalConfigurationParameters): void;
}

function getUserHome() {
  return process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname;
}

export const GLOBALCONFIG_FILENAME = join(getUserHome(), 'dc-cli-global.config.json');

export class CommandLineParserService implements CommandLineParser<ConfiguartionParameters> {
  public parse(
    args: string | string[] = process.argv,
    options: CommandOptions = globalCommandOptions
  ): ConfiguartionParameters {
    return yargs
      .config()
      .command('configure', 'Saves the configuration options to a file', {}, (argv: CommandOptions) => {
        const { hub, key, secret } = argv;
        this.storeGlobal({
          hub,
          key,
          secret
        });
      })
      .options(globalCommandOptions)
      .parse(args);
  }
  public storeGlobal(jsonObj: CommandOptions) {
    fs.writeFile(GLOBALCONFIG_FILENAME, JSON.stringify(jsonObj), err => {
      if (err) {
        console.error(err);
      }
    });
  }
}
