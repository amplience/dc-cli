import { Arguments, Argv } from 'yargs';
import { FileLog } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { nothingExportedExit as nothingToDeleteExit } from '../../services/export.service';
import { Webhook } from 'dc-management-sdk-js';
import { asyncQuestion } from '../../common/question-helpers';
import { progressBar } from '../../common/progress-bar/progress-bar';
import { filterById } from '../../common/filter/filter';
import { DeleteWebhookBuilderOptions } from '../../interfaces/delete-webhook-builder-options';

export const command = 'delete [id]';

export const desc = 'Delete Webhook';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('webhook', 'delete', platform);

export const coerceLog = (logFile: string): FileLog => createLog(logFile, 'Webhook Delete Log');

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe:
        'The ID of the webhook to be deleted. If id is not provided, this command will delete ALL webhooks in the hub.'
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, there will be no confirmation prompt before deleting the found webhooks.'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: coerceLog
    });
};

export const processWebhooks = async (webhooksToDelete: Webhook[], log: FileLog): Promise<void> => {
  const failedWebhooks: Webhook[] = [];

  const progress = progressBar(webhooksToDelete.length, 0, {
    title: `Deleting ${webhooksToDelete.length} webhook/s.`
  });

  for (const [i, webhook] of webhooksToDelete.entries()) {
    try {
      await webhook.related.delete();
      log.addComment(`Successfully deleted "${webhook.label}"`);
      progress.increment();
    } catch (e) {
      failedWebhooks.push(webhook);
      webhooksToDelete.splice(i, 1);
      log.addComment(`Failed to delete ${webhook.label}: ${e.toString()}`);
      progress.increment();
    }
  }

  progress.stop();

  if (failedWebhooks.length > 0) {
    log.appendLine(`Failed to delete ${failedWebhooks.length} webhooks`);
  }
};

export const handler = async (
  argv: Arguments<DeleteWebhookBuilderOptions & ConfigurationParameters>
): Promise<void> => {
  const { id, logFile, force } = argv;

  const client = dynamicContentClientFactory(argv);

  const allWebhooks = !id;

  const hub = await client.hubs.get(argv.hubId);

  const storedWebhooks = await paginator(hub.related.webhooks.list);

  const idArray: string[] = id ? (Array.isArray(id) ? id : [id]) : [];
  const webhooksToDelete = filterById(storedWebhooks, idArray, true);

  const log = logFile.open();

  if (webhooksToDelete.length === 0) {
    nothingToDeleteExit(log, 'No webhooks to delete from this hub, exiting.');
    return;
  }

  if (!force) {
    const yes = await asyncQuestion(
      allWebhooks
        ? `Providing no ID/s will delete ALL webhooks! Are you sure you want to do this? (Y/n)\n`
        : `${webhooksToDelete.length} webhook/s will be deleted. Would you like to continue? (Y/n)\n`
    );
    if (!yes) {
      return;
    }
  }

  log.addComment(`Deleting ${webhooksToDelete.length} webhook/s.`);

  await processWebhooks(webhooksToDelete, log);

  log.appendLine(`Finished successfully deleting ${webhooksToDelete.length} webhook/s`);

  await log.close();
};
