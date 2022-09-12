import YAML from 'yaml';
import { join, dirname } from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { DynamicContent } from 'dc-management-sdk-js';
import { handler as configure, CONFIG_FILENAME } from '../commands/configure';
import { Arguments } from 'yargs';

// eslint-disable-next-line
const { AutoComplete, Input, Password } = require('enquirer');

export const getConfigPath = (platform: string = process.platform): string =>
  join(process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname, '.amplience', 'config.yaml');
export const CONFIG_PATH = getConfigPath();

export type HubConfiguration = {
  clientId: string;
  clientSecret: string;
  hubId: string;
  name?: string;
  isActive?: boolean;
};

const validateHub = async (creds: HubConfiguration): Promise<HubConfiguration> => {
  const client = new DynamicContent({
    client_id: creds.clientId,
    client_secret: creds.clientSecret
  });
  const hub = await client.hubs.get(creds.hubId);
  return {
    ...creds,
    name: hub.name
  };
};

const read = (): HubConfiguration[] => {
  fs.mkdirpSync(dirname(CONFIG_PATH));
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, YAML.stringify([]), { encoding: 'utf-8' });
  }
  return YAML.parse(fs.readFileSync(CONFIG_PATH, { encoding: 'utf-8' }));
};

const hubs = read();

const saveConfig = (): void => {
  fs.writeFileSync(CONFIG_PATH, YAML.stringify(hubs, undefined, 4), { encoding: 'utf-8' });
};

const activateHub = (creds: HubConfiguration): HubConfiguration => {
  // make it active
  configure({
    ...creds,
    config: CONFIG_FILENAME(),
    _: [],
    $0: ''
  });

  console.log(`${chalk.green.bold('using')} hub [ ${chalk.green(creds.name || '')} ]`);
  return creds;
};

const getHub = (name: string): HubConfiguration | undefined => {
  return hubs.find(hub => name === hub.name);
};

const getHubs = (): HubConfiguration[] => {
  const activeHub = fs.readJSONSync(CONFIG_FILENAME());
  return hubs.map(hub => ({
    ...hub,
    isActive:
      activeHub.clientId === hub.clientId &&
      activeHub.clientSecret === hub.clientSecret &&
      activeHub.hubId === hub.hubId
  }));
};

// formatting helpers
const ask = async (message: string): Promise<string> => await new Input({ message }).run();
const secureAsk = async (message: string): Promise<string> => await new Password({ message }).run();
const helpTag = (message: string): string => chalk.gray(`(${message})`);
const sectionHeader = (message: string): void => console.log(`\n${message}\n`);

const dcTag = chalk.bold.cyanBright('dynamic content');
const credentialsHelpText = helpTag('credentials assigned by Amplience support');
const hubIdHelpText = helpTag('found in hub settings -> properties');

export const addHub = async (): Promise<void> => {
  try {
    // dc config
    sectionHeader(`${dcTag} configuration ${credentialsHelpText}`);

    const clientId = await ask(`client ${chalk.magenta('id')}:`);
    const clientSecret = await secureAsk(`client ${chalk.magenta('secret')}:`);
    const hubId = await ask(`hub id ${hubIdHelpText}:`);

    // unique key for a hub is clientId/hubId
    if (hubs.find(hub => clientId === hub.clientId && hubId === hub.hubId)) {
      throw new Error(`config already exists for client id [ ${clientId} ] and hub id [ ${hubId} ]`);
    }

    const validated = await validateHub({
      clientId,
      clientSecret,
      hubId
    });

    if (validated && validated.name) {
      hubs.push(validated);
      saveConfig();
      console.log(`${chalk.blueBright('added')} hub [ ${chalk.green(validated.name)} ]`);
      await activateHub(validated);
    }
  } catch (error) {
    console.log(chalk.red(error));
  }
};

const useHub = async (argv: Arguments<{ hub: string }>): Promise<void> => {
  const hubs = getHubs();
  let hub = argv.hub;

  // if hub is passed in on the cli
  if (!argv.hub) {
    const hubWithId = await new AutoComplete({
      name: 'hub',
      message: `choose a hub`,
      limit: hubs.length,
      multiple: false,
      choices: hubs.map(hub => `${hub.hubId} ${hub.name}`),
      initial: hubs.findIndex(hub => hub.isActive)
    }).run();
    hub = hubWithId.split(' ').pop();
  }

  const hubConfig = getHub(hub);
  if (!hubConfig) {
    throw new Error(`hub not found: ${hub}`);
  }

  await activateHub(hubConfig);
};

const listHubs = (): void => {
  getHubs().forEach(hub => {
    const hubName = hub.isActive ? chalk.green.bold(hub.name || '') : hub.name;
    console.log(`${hub.hubId}\t${hubName}`);
  });
};

const ConfigManager = {
  getHub,
  getHubs,
  addHub,
  listHubs,
  useHub
};

export default ConfigManager;
