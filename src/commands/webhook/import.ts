import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { FileLog } from '../../common/file-log';
import { join, extname } from 'path';
import { readdir, readFile } from 'graceful-fs';
import { promisify } from 'util';
import { ImportItemBuilderOptions } from '../../interfaces/import-item-builder-options.interface';
import { Hub, Webhook } from 'dc-management-sdk-js';
import { ContentMapping } from '../../common/content-mapping';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { asyncQuestion } from '../../common/question-helpers';
import { progressBar } from '../../common/progress-bar/progress-bar';
import PublishOptions from '../../common/publish/publish-options';

export function getDefaultMappingPath(name: string, platform: string = process.platform): string {
  return join(
    process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname,
    '.amplience',
    `imports/`,
    `${name}.json`
  );
}

export const command = 'import <dir>';

export const desc = 'Import Webhooks';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('webhook', 'import', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Directory containing webhooks to import.',
      type: 'string',
      requiresArg: true
    })
    .option('mapFile', {
      type: 'string',
      describe:
        'Mapping file to use when updating webhooks that already exists. Updated with any new mappings that are generated. If not present, will be created.'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: createLog
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'Overwrite webhooks.'
    })
    .alias('s', 'silent')
    .option('s', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, no log file will be produced.'
    });
};

interface WebhookImportResult {
  newItem: Webhook;
  state: 'UPDATED' | 'CREATED';
}

const createOrUpdateWebhook = async (
  hub: Hub,
  item: Webhook,
  existing: string | Webhook | null
): Promise<WebhookImportResult> => {
  let oldItem: Webhook | null = null;
  if (typeof existing === 'string') {
    oldItem = await hub.related.webhooks.get(existing);
  } else {
    oldItem = existing;
  }

  let result: WebhookImportResult;

  if (oldItem == null) {
    result = { newItem: await hub.related.webhooks.create(item), state: 'CREATED' };
  } else {
    result = { newItem: await oldItem.related.update(item), state: 'UPDATED' };
  }

  return result;
};

const trySaveMapping = async (mapFile: string | undefined, mapping: ContentMapping, log: FileLog): Promise<void> => {
  if (mapFile != null) {
    try {
      await mapping.save(mapFile);
    } catch (e) {
      log.appendLine(`Failed to save the mapping. ${e.toString()}`);
    }
  }
};

const prepareWebhooksForImport = async (
  hub: Hub,
  webhookFiles: string[],
  mapping: ContentMapping,
  log: FileLog,
  argv: Arguments<ImportItemBuilderOptions & ConfigurationParameters>
): Promise<Webhook[] | null> => {
  const { force } = argv;

  let webhooks: Webhook[] = [];

  for (let i = 0; i < webhookFiles.length; i++) {
    log.appendLine(`Reading webhook data in '${webhookFiles[i]}' for hub '${hub.label}'...`);

    if (extname(webhookFiles[i]) !== '.json') {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let webhookJSON: any;
    try {
      const webhookText = await promisify(readFile)(webhookFiles[i], {
        encoding: 'utf8'
      });
      webhookJSON = JSON.parse(webhookText);

      if (webhookJSON?.secret) delete webhookJSON.secret;
      if (webhookJSON?.createdDate) delete webhookJSON.createdDate;
      if (webhookJSON?.lastModifiedDate) delete webhookJSON.lastModifiedDate;

      if (webhookJSON?.headers) {
        webhookJSON.headers = webhookJSON.headers.filter((h: { secret: string }) => !h.secret);
      }

      if (webhookJSON?.customPayload?.value) {
        webhookJSON.customPayload.value = webhookJSON.customPayload.value
          .replace(/account="([^"]*)"/g, `account="${hub.name}"`)
          .replace(
            /stagingEnvironment="([^"]*)"/g,
            `stagingEnvironment="${hub.settings?.virtualStagingEnvironment?.hostname}"`
          );
      }
    } catch (e) {
      log.appendLine(`Couldn't read webhook at '${webhookFiles[i]}': ${e.toString()}`);
      return null;
    }

    webhooks.push(new Webhook(webhookJSON));
  }

  const alreadyExists = webhooks.filter(item => mapping.getWebhook(item.id) != null);
  if (alreadyExists.length > 0) {
    const updateExisting =
      force ||
      (await asyncQuestion(
        `${alreadyExists.length} of the webhooks being imported already exist in the mapping. Would you like to update these webhooks instead of skipping them? (y/n) `,
        log
      ));

    if (!updateExisting) {
      webhooks = webhooks.filter(item => mapping.getWebhook(item.id) == null);
    }
  }

  return webhooks;
};

const importWebhooks = async (
  hub: Hub,
  webhooks: Webhook[],
  mapping: ContentMapping,
  log: FileLog
): Promise<boolean> => {
  const abort = (error: Error): void => {
    log.appendLine(`Importing webhook failed, aborting. Error: ${error.toString()}`);
  };

  const importProgress = progressBar(webhooks.length, 0, {
    title: 'Importing webhooks'
  });

  for (let j = 0; j < webhooks.length; j++) {
    const item = webhooks[j];

    const originalId = item.id;
    item.id = mapping.getWebhook(item.id as string) || '';

    if (!item.id) {
      delete item.id;
    }

    let newItem: Webhook;
    let state: 'CREATED' | 'UPDATED';

    try {
      const result = await createOrUpdateWebhook(hub, item, mapping.getWebhook(originalId as string) || null);

      newItem = result.newItem;
      state = result.state;
    } catch (e) {
      importProgress.stop();
      log.error(`Failed creating ${item.label}:`, e);
      abort(e);
      return false;
    }

    log.addComment(`${state} ${item.label}.`);
    log.addAction(state, (newItem.id || 'unknown') + (state === 'UPDATED' ? `  ${newItem.label}` : ''));

    mapping.registerWebhook(originalId as string, newItem.id as string);

    importProgress.increment();
  }

  importProgress.stop();

  return true;
};

export const handler = async (
  argv: Arguments<PublishOptions & ImportItemBuilderOptions & ConfigurationParameters>
): Promise<boolean> => {
  const { dir, logFile, silent } = argv;
  let { mapFile } = argv;
  const client = dynamicContentClientFactory(argv);
  const log = logFile.open();
  const hub: Hub = await client.hubs.get(argv.hubId);
  const importTitle = `hub-${hub.id}`;

  const mapping = new ContentMapping();
  if (mapFile == null) {
    mapFile = getDefaultMappingPath(importTitle);
  }

  if (await mapping.load(mapFile)) {
    log.appendLine(`Existing mapping loaded from '${mapFile}', changes will be saved back to it.`);
  } else {
    log.appendLine(`Creating new mapping file at '${mapFile}'.`);
  }

  const baseDirContents = await promisify(readdir)(dir);

  const webhookFiles = baseDirContents.map(wh => {
    return `${dir}/${wh}`;
  });

  const webhooks = await prepareWebhooksForImport(hub, webhookFiles, mapping, log, argv);
  let result = true;

  if (webhooks != null) {
    result = await importWebhooks(hub, webhooks, mapping, log);
  } else {
    log.appendLine('No webhooks found to import.');
  }

  trySaveMapping(mapFile, mapping, log);

  await log.close(!silent);
  return result;
};
