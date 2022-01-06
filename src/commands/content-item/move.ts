import { createLog, getDefaultLogPath, openRevertLog } from '../../common/log-helpers';
import { Argv, Arguments } from 'yargs';
import { CopyItemBuilderOptions } from '../../interfaces/copy-item-builder-options.interface';
import { ConfigurationParameters } from '../configure';

import * as copy from './copy';

import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentItem, Status } from 'dc-management-sdk-js';
import { revert } from './import-revert';
import { LogErrorLevel } from '../../common/archive/archive-log';

export const command = 'move';

export const desc = 'Move content items. The active account and hub are the source for the move.';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('item', 'move', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .option('revertLog', {
      type: 'string',
      describe:
        'Path to a log file to revert a move for. This will archive the most recently moved resources from the destination, unarchive from the source, and revert updated ones.',
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
        "Move content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
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

export const handler = async (argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters>): Promise<void> => {
  argv.exportedIds = [];

  const { hubId, clientId, clientSecret } = argv;

  const revertLog = await argv.revertLog;
  const dstHubId = argv.dstHubId || hubId;
  const dstClientId = argv.dstClientId || clientId;
  const dstSecret = argv.dstSecret || clientSecret;

  if (revertLog) {
    if (revertLog.errorLevel === LogErrorLevel.INVALID) {
      console.error('Could not read the revert log.');
      return;
    }

    const client = dynamicContentClientFactory({
      ...argv,
      hubId: hubId,
      clientId: clientId,
      clientSecret: clientSecret
    });

    const toUnarchive = revertLog.getData('MOVED'); // Undo moved content by unarchiving it.

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

      hubId: dstHubId,
      clientId: dstClientId,
      clientSecret: dstSecret,

      dir: '', // unused

      logFile: argv.logFile,
      revertLog: argv.revertLog
    });
  } else {
    const log = argv.logFile.open();
    argv.logFile = log;

    const copySuccess = await copy.handler(argv);

    if (!copySuccess) {
      return;
    }

    const client = dynamicContentClientFactory({
      ...argv,
      hubId: hubId,
      clientId: clientId,
      clientSecret: clientSecret
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
