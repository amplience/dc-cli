import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { Argv, Arguments } from 'yargs';
import { CopyItemBuilderOptions } from '../../interfaces/copy-item-builder-options.interface';
import { ConfigurationParameters } from '../configure';

import * as copy from './copy';

import { FileLog } from '../../common/file-log';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentItem, Status } from 'dc-management-sdk-js';
import { loadCopyConfig } from '../../common/content-item/copy-config';
import { revert } from './import-revert';

export const command = 'move';

export const desc = 'Move content items. The active account and hub are the source for the move.';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('item', 'move', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .option('revertLog', {
      type: 'string',
      describe:
        'Path to a log file to revert a move for. This will archive the most recently moved resources from the destination, unarchive from the source, and revert updated ones.'
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
    });
};

export const handler = async (argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters>): Promise<void> => {
  argv.exportedIds = [];

  if (argv.revertLog != null) {
    const copyConfig = await loadCopyConfig(argv, new FileLog());

    if (copyConfig == null) {
      return;
    }

    const client = dynamicContentClientFactory({
      ...argv,
      hubId: copyConfig.srcHubId,
      clientId: copyConfig.srcClientId,
      clientSecret: copyConfig.srcSecret
    });

    const log = new FileLog();
    try {
      await log.loadFromFile(argv.revertLog as string);
    } catch (e) {
      console.log('Could not open the import log! Aborting.');
      return;
    }

    const toUnarchive = log.getData('MOVED'); // Undo moved content by unarchiving it.

    for (let i = 0; i < toUnarchive.length; i++) {
      const id = toUnarchive[i];

      let item: ContentItem;
      try {
        item = await client.contentItems.get(id);
      } catch {
        console.log(`Could not find item with id ${id}, skipping.`);
        continue;
      }

      if (item.status !== Status.ACTIVE) {
        try {
          await item.related.unarchive();
        } catch {
          console.log(`Could not unarchive item with id ${id}, skipping.`);
          continue;
        }
      } else {
        console.log(`Item with id ${id} is already unarchived, skipping.`);
      }
    }

    const yargArgs = {
      $0: '',
      _: [],
      json: true
    };

    await revert({
      ...yargArgs,

      hubId: copyConfig.dstHubId,
      clientId: copyConfig.dstClientId,
      clientSecret: copyConfig.dstSecret,

      dir: '', // unused

      logFile: log,
      revertLog: argv.revertLog
    });
  } else {
    const log = argv.logFile.open();
    argv.logFile = log;

    const copyConfig = await loadCopyConfig(argv, log);

    if (copyConfig == null) {
      return;
    }

    argv.copyConfig = copyConfig;

    const copySuccess = await copy.handler(argv);

    if (!copySuccess) {
      return;
    }

    const client = dynamicContentClientFactory({
      ...argv,
      hubId: copyConfig.srcHubId,
      clientId: copyConfig.srcClientId,
      clientSecret: copyConfig.srcSecret
    });

    // Only archive the result of the export once the copy has completed.
    // This ensures the content is always active in one location if something goes wrong.

    const exported = argv.exportedIds;

    for (let i = 0; i < exported.length; i++) {
      const item = await client.contentItems.get(exported[i]);

      try {
        await item.related.archive();
        log.addAction('MOVED', item.id as string);
      } catch (e) {
        log.addComment(`ARCHIVE FAILED: ${item.id}`);
        log.addComment(e.toString());
      }
    }

    await log.close();
  }
};
