import { createLog, getDefaultLogPath, openRevertLog } from '../../common/log-helpers';
import { Argv, Arguments } from 'yargs';
import { join } from 'path';
import { CopyItemBuilderOptions } from '../../interfaces/copy-item-builder-options.interface';
import { ConfigurationParameters } from '../configure';
import rmdir from 'rimraf';

import { handler as exporter } from './export';
import { handler as importer } from './import';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { revert } from './import-revert';
import { FileLog } from '../../common/file-log';
import { LogErrorLevel } from '../../common/archive/archive-log';
import { withOldFilters } from '../../common/filter/facet';

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
        'Path to a log file to revert a copy for. This will archive the most recently copied resources, and revert updated ones.',
      coerce: openRevertLog
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

    .option('facet', {
      type: 'string',
      describe:
        "Copy content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
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

    .option('lastPublish', {
      type: 'boolean',
      boolean: true,
      describe: 'When available, export the last published version of a content item rather than its newest version.'
    })

    .option('publish', {
      type: 'boolean',
      boolean: true,
      describe:
        'Publish any content items that either made a new version on import, or were published more recently in the JSON.'
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

    .option('media', {
      type: 'boolean',
      boolean: true,
      describe:
        "Detect and rewrite media links to match assets in the target account's DAM. Your client must have DAM permissions configured."
    })

    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: createLog
    })

    .option('name', {
      type: 'string',
      hidden: true
    })

    .option('schemaId', {
      type: 'string',
      hidden: true
    });
};

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

export const handler = async (argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters>): Promise<boolean> => {
  const log = argv.logFile.open();
  const tempFolder = getTempFolder(Date.now().toString());

  const yargArgs = {
    $0: '',
    _: [],
    json: true
  };

  let result = false;

  const { hubId, clientId, clientSecret } = argv;

  const dstHubId = argv.dstHubId || hubId;
  const dstClientId = argv.dstClientId || clientId;
  const dstSecret = argv.dstSecret || clientSecret;

  const revertLog = await argv.revertLog;

  if (revertLog) {
    if (revertLog.errorLevel === LogErrorLevel.INVALID) {
      log.error('Could not read the revert log.');
      await log.close();
      return false;
    }

    result = await revert({
      ...yargArgs,

      hubId: dstHubId,
      clientId: dstClientId,
      clientSecret: dstSecret,

      dir: tempFolder, // unused
      logFile: new FileLog(),

      revertLog: argv.revertLog
    });
  } else {
    await ensureDirectoryExists(tempFolder);

    try {
      log.appendLine('=== Exporting from source... ===');

      await exporter({
        ...yargArgs,
        hubId: hubId,
        clientId: clientId,
        clientSecret: clientSecret,

        folderId: argv.srcFolder,
        repoId: argv.srcRepo,
        facet: withOldFilters(argv.facet, argv),
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

        republish: argv.republish,
        publish: argv.publish,

        excludeKeys: argv.excludeKeys,

        media: argv.media,
        logFile: log,
        revertLog: Promise.resolve(undefined)
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

  await log.close();

  return result;
};
