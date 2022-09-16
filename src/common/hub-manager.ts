import { join, dirname } from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { DynamicContent } from 'dc-management-sdk-js';
import { handler as configure, CONFIG_FILENAME } from '../commands/configure';
import { Arguments } from 'yargs';

// eslint-disable-next-line
const { AutoComplete, Input, Password } = require('enquirer');

export const getConfigPath = (platform: string = process.platform): string =>
  join(process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname, '.amplience', 'hubs.json');
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

const readHubs = (): HubConfiguration[] => {
  fs.mkdirpSync(dirname(CONFIG_PATH));
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify([]), { encoding: 'utf-8' });
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, { encoding: 'utf-8' }));
};

const hubs = readHubs();

const saveConfig = (): void => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(hubs, undefined, 4), { encoding: 'utf-8' });
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

export const addHub = async (
  args: Arguments<{ clientId: string; clientSecret: string; hubId: string }>
): Promise<void> => {
  try {
    // dc config
    sectionHeader(`${dcTag} configuration ${credentialsHelpText}`);

    // novadev-693 allow id, secret, and hub id to be passed via command line
    const clientId = args.clientId || (await ask(`client ${chalk.magenta('id')}:`));
    const clientSecret = args.clientSecret || (await secureAsk(`client ${chalk.magenta('secret')}:`));
    const hubId = args.hubId || (await ask(`hub id ${hubIdHelpText}:`));

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

const chooseHub = async (filter: string): Promise<HubConfiguration> => {
  const filtered = getHubs().filter(
    hub => (hub.name && hub.name.indexOf(filter) > -1) || hub.hubId.indexOf(filter) > -1
  );

  if (filtered.length === 1) {
    return filtered[0];
  }

  if (filtered.length === 0) {
    throw new Error(`hub configuration not found for filter [ ${chalk.red(filter)} ]`);
  }

  const hubWithId = await new AutoComplete({
    name: 'hub',
    message: `choose a hub`,
    limit: filtered.length,
    multiple: false,
    choices: filtered.map(hub => `${hub.hubId} ${hub.name}`),
    initial: filtered.findIndex(hub => hub.isActive)
  }).run();
  return await chooseHub(hubWithId.split(' ')[0]);
};

const useHub = async (argv: Arguments<{ hub: string }>): Promise<void> => {
  const hubConfig = await chooseHub(argv.hub);
  await activateHub(hubConfig);
};

const listHubs = (): void => {
  getHubs().forEach(hub => {
    // novadev-695 provide a non-color indicator for active hub
    const hubName = hub.isActive ? chalk.green.bold(`* ${hub.name}` || '') : `  ${hub.name}`;
    console.log(`${hub.hubId} ${hub.clientId.substring(0, 8)} ${hubName}`);
  });
};

const ConfigManager = {
  getHubs,
  addHub,
  listHubs,
  useHub
};

export default ConfigManager;
