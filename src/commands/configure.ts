import { Arguments } from 'yargs';
import { CommandOptions } from '../interfaces/command-options.interface';
import fs from 'fs';
import { join, dirname } from 'path';
import { isEqual } from 'lodash';

export const command = 'configure';

export const desc = 'Saves the configuration options to a file';

export const CONFIG_FILENAME = (platform: string = process.platform): string =>
  join(process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname, '.amplience', 'dc-cli-config.json');

export type ConfigurationParameters = {
  clientId: string;
  clientSecret: string;
  hubId: string;
};

export const configureCommandOptions: CommandOptions = {
  clientId: { type: 'string', demandOption: true },
  clientSecret: { type: 'string', demandOption: true },
  hubId: { type: 'string', demandOption: true },
  config: { type: 'string', default: CONFIG_FILENAME() }
};

const writeConfigFile = (configFile: string, parameters: ConfigurationParameters): void => {
  const dir = dirname(configFile);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      throw new Error(`Unable to create dir "${dir}". Reason: ${err}`);
    }
  }
  try {
    fs.writeFileSync(configFile, JSON.stringify(parameters));
  } catch (err) {
    throw new Error(`Unable to write config file "${configFile}". Reason: ${err}`);
  }
};

export const readConfigFile = (configFile: string): object =>
  fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf-8')) : {};

export const handler = (argv: Arguments<ConfigurationParameters>): void => {
  const { clientId, clientSecret, hubId } = argv;
  const storedConfig = readConfigFile(CONFIG_FILENAME());

  if (isEqual(storedConfig, { clientId, clientSecret, hubId })) {
    console.log('Config file up-to-date.  Please use `--help` for command usage.');
    return;
  }
  writeConfigFile(CONFIG_FILENAME(), { clientId, clientSecret, hubId });
  console.log('Config file updated.');
};
