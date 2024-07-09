import yargs, { Arguments, Argv } from 'yargs';
import { readConfig } from '../cli';
import { CommandOptions } from '../interfaces/command-options.interface';
import fs from 'fs';
import { join, dirname } from 'path';
import { isEqual } from 'lodash';

export const command = 'configure';

export const desc = 'Saves the configuration options to a file';

export const CONFIG_FILENAME = (platform: string = process.platform): string =>
  join(process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname, '.amplience', 'dc-cli-config.json');

export const configureCommandOptions: CommandOptions = {
  clientId: { type: 'string', demandOption: false },
  clientSecret: { type: 'string', demandOption: false },
  hubId: { type: 'string', demandOption: true },
  patToken: { type: 'string', demandOption: false },

  config: { type: 'string', default: CONFIG_FILENAME() }
};

export const builder = (yargs: Argv): void => {
  yargs
    .options(configureCommandOptions)
    .config('config', readConfig)
    .option('dstHubId', {
      type: 'string',
      describe: 'Destination hub ID. If not specified, it will be the same as the source.'
    })

    .option('dstClientId', {
      type: 'string',
      describe: "Destination account's client ID. If not specified, it will be the same as the source."
    })

    .option('dstSecret', {
      type: 'string',
      describe: "Destination account's secret. Must be used alongside dstClientId."
    });
};

const getCommandLineArgs = (): Arguments => {
  const rawArgs = process.argv.slice(2);
  return yargs(rawArgs)
    .option('clientId', { type: 'string' })
    .option('clientSecret', { type: 'string' })
    .option('patToken', { type: 'string' }).argv;
};

export type ConfigurationParameters = {
  clientId?: string;
  clientSecret?: string;
  patToken?: string;
  hubId: string;

  dstClientId?: string;
  dstSecret?: string;
  dstHubId?: string;
};

type ConfigArgument = {
  config: string;
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

export const readConfigFile = (configFile: string, ignoreError?: boolean): object => {
  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    } catch (e) {
      if (ignoreError) {
        console.error(
          `The configuration file at ${configFile} is invalid, its contents will be ignored.\n${e.message}`
        );
      } else {
        console.error(
          `FATAL - Could not parse JSON configuration. Inspect the configuration file at ${configFile}\n${e.message}`
        );
        process.exit(2);
      }
    }
  }

  return {};
};

export const handler = (argv: Arguments<ConfigurationParameters & ConfigArgument>): void => {
  const { clientId, clientSecret, hubId, patToken } = argv;
  const storedConfig = readConfigFile(argv.config);
  const newConfig: ConfigurationParameters = { clientId, clientSecret, hubId, patToken };
  const commandLineArgs = getCommandLineArgs();

  if ((commandLineArgs.clientId || commandLineArgs.clientSecret) && commandLineArgs.patToken) {
    console.error('Error: Specify clientId & clientSecret or patToken, not both');
    return;
  }
  if (commandLineArgs.patToken && (clientId || clientSecret)) {
    delete newConfig.clientId;
    delete newConfig.clientSecret;
  }
  if ((commandLineArgs.clientId || commandLineArgs.clientSecret) && patToken) {
    delete newConfig.patToken;
  }
  if (argv.dstClientId) newConfig.dstClientId = argv.dstClientId;
  if (argv.dstSecret) newConfig.dstSecret = argv.dstSecret;
  if (argv.dstHubId) newConfig.dstHubId = argv.dstHubId;

  if (isEqual(storedConfig, newConfig)) {
    console.log('Config file up-to-date.  Please use `--help` for command usage.');
    return;
  }
  writeConfigFile(argv.config, newConfig);
  console.log('Config file updated.');
};
