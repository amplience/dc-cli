import { getDefaultLogPath } from '../../common/log-helpers';
import { Argv, Arguments } from 'yargs';
import { join } from 'path';
import { CopyItemBuilderOptions } from '../../interfaces/copy-item-builder-options.interface';
import { ConfigurationParameters } from '../configure';
import rmdir from 'rimraf';

import { handler as exporter } from './export';
import { handler as importer } from './import';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { FileLog } from '../../common/file-log';
import { revert } from './import-revert';
import { loadCopyConfig } from '../../common/content-item/copy-config';

export function getTempFolder(name: string, platform: string = process.platform): string {
  return join(process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname, '.amplience', `copy-${name}/`);
}

export const command = 'copy';

export const desc = 'Copy content items. The active account and hub are the source for the copy.';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('item', 'copy', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .option('revertLog', {
      type: 'string',
      describe:
        'Path to a log file to revert a copy for. This will archive the most recently copied resources, and revert updated ones.'
    })

    .option('srcRepo', {
      type: 'string',
      describe:
        'Copy content from within a given repository. Directory structure will start at the specified repository. Will automatically export all contained folders.'
    })

    .option('srcFolder', {
      type: 'string',
      describe:
        'Copy content from within a given folder. Directory structure will start at the specified folder. Can be used in addition to repoId.'
    })

    .option('dstRepo', {
      type: 'string',
      describe:
        'Copy matching the given repository to the source base directory, by ID. Folder structure will be followed and replicated from there.'
    })

    .option('dstFolder', {
      type: 'string',
      describe:
        'Copy matching the given folder to the source base directory, by ID. Folder structure will be followed and replicated from there.'
    })

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
    })

    .option('mapFile', {
      type: 'string',
      describe:
        'Mapping file to use when updating content that already exists. Updated with any new mappings that are generated. If not present, will be created.'
    })

    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe:
        'Overwrite content, create and assign content types, and ignore content with missing types/references without asking.'
    })

    .alias('v', 'validate')
    .option('v', {
      type: 'boolean',
      boolean: true,
      describe: 'Only recreate folder structure - content is validated but not imported.'
    })

    .option('skipIncomplete', {
      type: 'boolean',
      boolean: true,
      describe: 'Skip any content item that has one or more missing dependancy.'
    })

    .option('copyConfig', {
      type: 'string',
      describe:
        'Path to a JSON configuration file for source/destination account. If the given file does not exist, it will be generated from the arguments.'
    })

    .option('lastPublish', {
      type: 'boolean',
      boolean: true,
      describe: 'When available, export the last published version of a content item rather than its newest version.'
    })

    .option('publish', {
      type: 'boolean',
      boolean: true,
      describe: 'Publish any content items that have an existing publish status in their JSON.'
    })

    .option('republish', {
      type: 'boolean',
      boolean: true,
      describe: 'Republish content items regardless of whether the import changed them or not. (--publish not required)'
    })

    .option('excludeKeys', {
      type: 'boolean',
      boolean: true,
      describe: 'Exclude delivery keys when importing content items.'
    })

    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.'
    });
};

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

export const handler = async (argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters>): Promise<boolean> => {
  const logFile = argv.logFile;
  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;
  const tempFolder = getTempFolder(Date.now().toString());

  const yargArgs = {
    $0: '',
    _: [],
    json: true
  };

  let result = false;

  const copyConfig = typeof argv.copyConfig !== 'object' ? await loadCopyConfig(argv, log) : argv.copyConfig;

  if (copyConfig == null) {
    return false;
  }

  const { srcHubId, srcClientId, srcSecret, dstHubId, dstClientId, dstSecret } = copyConfig;

  if (argv.revertLog) {
    result = await revert({
      ...yargArgs,

      hubId: dstHubId,
      clientId: dstClientId,
      clientSecret: dstSecret,

      dir: tempFolder, // unused

      revertLog: argv.revertLog
    });
  } else {
    await ensureDirectoryExists(tempFolder);

    try {
      log.appendLine('=== Exporting from source... ===');

      await exporter({
        ...yargArgs,
        hubId: srcHubId,
        clientId: srcClientId,
        clientSecret: srcSecret,

        folderId: argv.srcFolder,
        repoId: argv.srcRepo,
        schemaId: argv.schemaId,
        name: argv.name,
        logFile: log,

        dir: tempFolder,

        exportedIds: argv.exportedIds,
        publish: argv.lastPublish
      });

      log.appendLine('=== Importing to destination... ===');

      const importResult = await importer({
        ...yargArgs,
        hubId: dstHubId,
        clientId: dstClientId,
        clientSecret: dstSecret,

        dir: tempFolder,

        baseRepo: argv.dstRepo,
        baseFolder: argv.dstFolder,
        mapFile: argv.mapFile,
        force: argv.force,
        validate: argv.validate,
        skipIncomplete: argv.skipIncomplete,
        logFile: log,

        republish: argv.republish,
        publish: argv.publish,

        excludeKeys: argv.excludeKeys
      });

      if (importResult) {
        log.appendLine('=== Done! ===');
        result = true;
      }
    } catch (e) {
      log.appendLine('An unexpected error occurred: \n' + e.toString());
    }

    await rimraf(tempFolder);
  }

  if (typeof logFile !== 'object') {
    await log.close();
  }

  return result;
};
