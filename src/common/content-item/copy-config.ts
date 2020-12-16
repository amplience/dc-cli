import { readFile, writeFile, existsSync, mkdir } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';
import { Arguments } from 'yargs';
import { ConfigurationParameters } from '../../commands/configure';
import { CopyItemBuilderOptions } from '../../interfaces/copy-item-builder-options.interface';
import { FileLog } from '../file-log';

export interface CopyConfig {
  srcHubId: string;
  srcClientId: string;
  srcSecret: string;

  dstHubId: string;
  dstClientId: string;
  dstSecret: string;
}

export class CopyConfigFile {
  config: CopyConfig;

  async save(filename: string): Promise<void> {
    const text = JSON.stringify(this.config);

    const dir = dirname(filename);
    if (!existsSync(dir)) {
      await promisify(mkdir)(dir);
    }
    await promisify(writeFile)(filename, text, { encoding: 'utf8' });
  }

  async load(filename: string): Promise<boolean> {
    let text: string;

    try {
      text = await promisify(readFile)(filename, { encoding: 'utf8' });
    } catch (e) {
      return false;
    }

    this.config = JSON.parse(text);

    return true;
  }
}

export async function loadCopyConfig(
  argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters>,
  log: FileLog
): Promise<CopyConfig | null> {
  let copyConfig: CopyConfig = {
    srcHubId: argv.hubId,
    srcClientId: argv.clientId,
    srcSecret: argv.clientSecret,

    dstHubId: argv.dstHubId || argv.hubId,
    dstClientId: argv.dstClientId || argv.clientId,
    dstSecret: argv.dstSecret || argv.clientSecret
  };

  if (argv.copyConfig != null && typeof argv.copyConfig === 'string') {
    const configFile = new CopyConfigFile();
    let exists = false;
    try {
      exists = await configFile.load(argv.copyConfig);
    } catch (e) {
      log.addComment(`Failed to load configuration file: ${e.toString()}`);
      await log.close();

      return null;
    }

    if (exists) {
      copyConfig = configFile.config;
    } else {
      // Save the current arguments as a config file.
      configFile.config = copyConfig;
      try {
        configFile.save(argv.copyConfig);
      } catch (e) {
        log.addComment(`Failed to save configuration file: ${e.toString()}`);
        log.addComment('Continuing.');
      }
    }
  }

  return copyConfig;
}
