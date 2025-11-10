import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { FileLog } from '../../common/file-log';
import { join, extname } from 'path';
import { readdir, readFile } from 'graceful-fs';
import { promisify } from 'util';
import { Hub, Webhook } from 'dc-management-sdk-js';
import { ContentMapping } from '../../common/content-mapping';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { asyncQuestion } from '../../common/question-helpers';
import { progressBar } from '../../common/progress-bar/progress-bar';
import PublishOptions from '../../common/publish/publish-options';
import { ImportWebhookBuilderOptions } from '../../interfaces/import-webhook-builder-options';

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
  webhook: Webhook;
  state: 'UPDATED' | 'CREATED';
}

export const createOrUpdateWebhook = async (
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
    result = { webhook: await hub.related.webhooks.create(item), state: 'CREATED' };
  } else {
    result = { webhook: await oldItem.related.update(item), state: 'UPDATED' };
  }

  return result;
};

export const trySaveMapping = async (
  mapFile: string | undefined,
  mapping: ContentMapping,
  log: FileLog
): Promise<void> => {
  if (mapFile != null) {
    try {
      await mapping.save(mapFile);
    } catch (e) {
      log.appendLine(`Failed to save the mapping. ${e.toString()}`);
    }
  }
};

export const prepareWebhooksForImport = async (
  hub: Hub,
  webhookFiles: string[],
  mapping: ContentMapping,
  log: FileLog,
  argv: Arguments<ImportWebhookBuilderOptions & ConfigurationParameters>
): Promise<Webhook[] | null> => {
  const { force } = argv;

  let webhooks: Webhook[] = [];

  for (const webhookFile of webhookFiles) {
    log.appendLine(`Reading webhook data in '${webhookFile}' for hub '${hub.label}'...`);

    if (extname(webhookFile) !== '.json') {
      return null;
    }

    let webhookJSON;

    try {
      const webhookText = await promisify(readFile)(webhookFile, {
        encoding: 'utf8'
      });

      webhookJSON = JSON.parse(webhookText);
    } catch (e) {
      log.appendLine(`Couldn't read webhook at '${webhookFile}': ${e.toString()}`);
      return null;
    }

    const webhook = new Webhook({
      ...(webhookJSON.id && { id: webhookJSON.id }),
      ...(webhookJSON.label && { label: webhookJSON.label }),
      ...(webhookJSON.events && { events: webhookJSON.events }),
      ...(webhookJSON.active && { active: webhookJSON.active }),
      ...(webhookJSON.handlers && { handlers: webhookJSON.handlers }),
      ...(webhookJSON.notifications && { notifications: webhookJSON.notifications }),
      ...(webhookJSON.headers && { headers: webhookJSON.headers }),
      ...(webhookJSON.filters && { filters: webhookJSON.filters }),
      ...(webhookJSON.customPayload && { customPayload: webhookJSON.customPayload }),
      ...(webhookJSON.method && { method: webhookJSON.method })
    });

    if (webhook?.headers) {
      webhook.headers = webhook.headers.filter(header => {
        return !header.secret;
      });
    }

    if (webhook?.customPayload?.value) {
      webhook.customPayload.value = webhook.customPayload.value
        .replace(/account="([^"]*)"/g, `account="${hub.name}"`)
        .replace(
          /stagingEnvironment="([^"]*)"/g,
          `stagingEnvironment="${hub.settings?.virtualStagingEnvironment?.hostname}"`
        );
    }

    webhooks.push(new Webhook(webhook));
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

export const importWebhooks = async (
  hub: Hub,
  webhooks: Webhook[],
  mapping: ContentMapping,
  log: FileLog
): Promise<void> => {
  const importProgress = progressBar(webhooks.length, 0, {
    title: 'Importing webhooks'
  });

  for (const webhookToImport of webhooks) {
    const originalId = webhookToImport.id;
    webhookToImport.id = mapping.getWebhook(webhookToImport.id as string) || '';

    if (!webhookToImport.id) {
      delete webhookToImport.id;
    }

    try {
      const { webhook, state } = await createOrUpdateWebhook(
        hub,
        webhookToImport,
        mapping.getWebhook(originalId as string) || null
      );

      log.addComment(`${state} ${webhook.label}.`);
      log.addAction(state, (webhook.id || 'unknown') + (state === 'UPDATED' ? `  ${webhook.label}` : ''));

      mapping.registerWebhook(originalId as string, webhook.id as string);

      importProgress.increment();
    } catch (e) {
      importProgress.stop();
      log.error(`Failed creating ${webhookToImport.label}:`, e);
      throw Error(`Importing webhook failed. Error: ${e.toString()}`);
    }
  }

  importProgress.stop();
};

export const handler = async (
  argv: Arguments<PublishOptions & ImportWebhookBuilderOptions & ConfigurationParameters>
): Promise<void> => {
  const { dir, logFile, force, silent, mapFile: mapFileArg } = argv;
  const client = dynamicContentClientFactory(argv);
  const log = logFile.open();
  const hub: Hub = await client.hubs.get(argv.hubId);
  const importTitle = `hub-${hub.id}`;
  const mapping = new ContentMapping();
  const mapFile = mapFileArg ? mapFileArg : getDefaultMappingPath(importTitle);

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

  if (webhooks !== null) {
    const proceedImport =
      force ||
      (await asyncQuestion(`${webhooks.length} webhook/s will be imported, do you wish to continue? (y/n) `, log));
    if (!proceedImport) {
      return;
    }

    await importWebhooks(hub, webhooks, mapping, log);
  } else {
    log.appendLine('No webhooks found to import.');
  }

  trySaveMapping(mapFile, mapping, log);

  await log.close(!silent);
};
