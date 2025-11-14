import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { nothingExportedExit, uniqueFilenamePath, writeJsonToFile } from '../../services/export.service';
import { Webhook } from 'dc-management-sdk-js';
import { FileLog } from '../../common/file-log';
import { join } from 'path';
import sanitize from 'sanitize-filename';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { progressBar } from '../../common/progress-bar/progress-bar';
import { confirmAllContent } from '../../common/content-item/confirm-all-content';
import { getWebhooksByIds } from '../../common/webhooks/get-webhooks-by-ids';
import { getAllWebhooks } from '../../common/webhooks/get-all-webhook';
import { ExportWebhookBuilderOptions } from '../../interfaces/export-webhook-builder-options';

export const command = 'export <dir>';

export const desc = 'Export Webhooks';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('webhook', 'export', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe:
        'The id of a the webhook to be exported. If id is not provided, this command will export ALL webhooks in the hub.'
    })
    .positional('dir', {
      describe: 'Output directory for the exported webhooks',
      type: 'string',
      requiresArg: true
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
      describe: 'If present, there will be no confirmation prompt before exporting the webhooks.'
    })
    .alias('s', 'silent')
    .option('s', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, no log file will be produced.'
    });
};

export const exportWebhooks = async (webhooks: Webhook[], dir: string, log: FileLog): Promise<void> => {
  const progress = progressBar(webhooks.length, 0, {
    title: `Exporting ${webhooks.length} webhooks.`
  });

  const filenames: string[] = [];

  for (let i = 0; i < webhooks.length; i++) {
    const webhook = webhooks[i];

    try {
      let resolvedPath: string;
      resolvedPath = 'exported_webhooks';

      const directory = join(dir, resolvedPath);
      resolvedPath = uniqueFilenamePath(directory, `${sanitize(webhook.label as string)}`, 'json', filenames);
      filenames.push(resolvedPath);

      await ensureDirectoryExists(directory);

      writeJsonToFile(resolvedPath, webhook);
      log.addComment(`Successfully exported "${webhook.label}"`);
      progress.increment();
    } catch (e) {
      log.addComment(`Failed to export ${webhook.label}: ${e.toString()}`);
      progress.increment();
    }
  }

  progress.stop();
};

export const handler = async (
  argv: Arguments<ExportWebhookBuilderOptions & ConfigurationParameters>
): Promise<void> => {
  const { id, logFile, dir, force, silent } = argv;
  const log = logFile.open();
  const client = dynamicContentClientFactory(argv);
  const allWebhooks = !id;
  const hub = await client.hubs.get(argv.hubId);
  let ids: string[] = [];

  if (id) {
    ids = Array.isArray(id) ? id : [id];
  }

  const webhooksToExport = ids.length > 0 ? await getWebhooksByIds(hub, ids) : await getAllWebhooks(hub);

  if (!webhooksToExport.length) {
    nothingExportedExit(log, 'No webhooks to export from this hub, exiting.');
    return;
  }

  log.appendLine(`Found ${webhooksToExport.length} webhooks to export`);

  if (!force) {
    const yes = await confirmAllContent('export', 'webhooks', allWebhooks, false);
    if (!yes) {
      return;
    }
  }

  log.appendLine(`Exporting ${webhooksToExport.length} webhooks.`);

  await exportWebhooks(webhooksToExport, dir, log);

  log.appendLine(`Finished successfully exporting ${webhooksToExport.length} webhooks`);

  await log.close(!silent);
};
