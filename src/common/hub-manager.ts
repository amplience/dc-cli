import { join, dirname } from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { handler as configure, CONFIG_FILENAME } from '../commands/configure';
import { Arguments } from 'yargs';
import dynamicContentClientFactory from '../services/dynamic-content-client-factory';
import { asyncQuestion } from './question-helpers';

// eslint-disable-next-line
const { AutoComplete, Input, Password } = require('enquirer');

export const CONFIG_PATH = join(
  process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname,
  '.amplience',
  'hubs.json'
);

export type HubConfiguration = {
  clientId: string;
  clientSecret: string;
  hubId: string;
  name?: string;
  isActive?: boolean;
  patToken?: string;
};

export const validateHub = async (creds: HubConfiguration): Promise<HubConfiguration> => {
  const client = dynamicContentClientFactory(creds);
  const hub = await client.hubs.get(creds.hubId);
  return {
    ...creds,
    name: hub.name
  };
};

const getHubs = (): HubConfiguration[] => {
  const activeHub = fs.readJSONSync(CONFIG_FILENAME());

  fs.mkdirpSync(dirname(CONFIG_PATH));
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify([]), { encoding: 'utf-8' });
  }

  const hubs = fs.readJSONSync(CONFIG_PATH, { encoding: 'utf-8' });
  return hubs.map((hub: HubConfiguration) => {
    const obj = {
      ...hub,
      isActive: activeHub.hubId === hub.hubId
    };

    return obj;
  });
};

const saveHub = (hub: HubConfiguration): void => {
  const hubs = [hub, ...getHubs().filter(h => h.hubId !== hub.hubId)];
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

// formatting helpers
const ask = async (message: string): Promise<string> => await new Input({ message }).run();
const secureAsk = async (message: string): Promise<string> => await new Password({ message }).run();
const helpTag = (message: string): string => chalk.gray(`(${message})`);
const sectionHeader = (message: string): void => console.log(`\n${message}\n`);

const dcTag = chalk.bold.cyanBright('dynamic content');
const credentialsHelpText = helpTag('credentials assigned by Amplience support');
const hubIdHelpText = helpTag('found in hub settings -> properties');

export const addHub = async (
  args: Arguments<{ clientId?: string; clientSecret?: string; hubId?: string; patToken?: string }>
): Promise<void> => {
  // dc config
  sectionHeader(`${dcTag} configuration ${credentialsHelpText}`);

  const usePAT = await asyncQuestion('Would you like to use a PAT Token? (y/n)\n');

  if (usePAT) {
    args.patToken = args.patToken || (await secureAsk(`PAT ${chalk.magenta('token')}:`));
  } else {
    // novadev-693 allow id, secret, and hub id to be passed via command line
    args.clientId = args.clientId || (await ask(`client ${chalk.magenta('id')}:`));
    args.clientSecret = args.clientSecret || (await secureAsk(`client ${chalk.magenta('secret')}:`));
  }

  args.hubId = args.hubId || (await ask(`hub id ${hubIdHelpText}:`));

  // unique key for a hub is clientId/hubId
  if (args.clientId && getHubs().find(hub => args.clientId === hub.clientId && args.hubId === hub.hubId)) {
    throw new Error(`config already exists for client id [ ${args.clientId} ] and hub id [ ${args.hubId} ]`);
  }

  if (usePAT && getHubs().find(hub => args.patToken === hub.patToken && args.hubId === hub.hubId)) {
    throw new Error(`config already exists for PAT Token and hub id [ ${args.hubId} ]`);
  }

  const validated = await validateHub(args as HubConfiguration);
  if (validated && validated.name) {
    saveHub(validated);
    console.log(`${chalk.blueBright('added')} hub [ ${chalk.green(validated.name)} ]`);
    await activateHub(validated);
  }
};

const chooseHub = async (filter: string, exact = false): Promise<HubConfiguration> => {
  const filtered = getHubs().filter(
    hub =>
      (hub.name && hub.name.indexOf(filter) > -1) || (exact ? hub.hubId === filter : hub.hubId.indexOf(filter) > -1)
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
  return await chooseHub(hubWithId.split(' ')[0], true);
};

const useHub = async (argv: Arguments<{ hub: string }>): Promise<HubConfiguration> => {
  const hubConfig = await chooseHub(argv.hub);
  return await activateHub(hubConfig);
};

const listHubs = (): void => {
  getHubs().forEach(hub => {
    const hubName = hub.isActive ? chalk.green.bold(`* ${hub.name}`) : `  ${hub.name}`;
    console.log(`${hub.hubId} ${hub.clientId?.substring(0, 8) || hub.patToken?.substring(0, 8)}  ${hubName}`);
  });
};

export default {
  getHubs,
  addHub,
  listHubs,
  useHub,
  validateHub
};
