import { Arguments, Argv } from 'yargs';
import { FileLog } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { nothingExportedExit as nothingToDeleteExit } from '../../services/export.service';
import { Webhook } from 'dc-management-sdk-js';
import { asyncQuestion } from '../../common/question-helpers';
import { progressBar } from '../../common/progress-bar/progress-bar';
import { DeleteWebhookBuilderOptions } from '../../interfaces/delete-webhook-builder-options';
import { getWebhooksByIds } from '../../common/webhooks/get-webhooks-by-ids';
import { getAllWebhooks } from '../../common/webhooks/get-all-webhook';

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

export const processWebhooks = async (
  webhooksToDelete: Webhook[],
  log: FileLog
): Promise<{ failedWebhooks: Webhook[] }> => {
  const failedWebhooks: Webhook[] = [];

  const progress = progressBar(webhooksToDelete.length, 0, {
    title: `Deleting ${webhooksToDelete.length} webhook/s.`
  });

  for (const webhook of webhooksToDelete) {
    try {
      await webhook.related.delete();
      log.addComment(`Successfully deleted "${webhook.label}"`);
      progress.increment();
    } catch (e) {
      failedWebhooks.push(webhook);
      log.addComment(`Failed to delete ${webhook.label}: ${e.toString()}`);
      progress.increment();
    }
  }

  progress.stop();

  return { failedWebhooks };
};

export const handler = async (
  argv: Arguments<DeleteWebhookBuilderOptions & ConfigurationParameters>
): Promise<void> => {
  const { id, logFile, force } = argv;
  const log = logFile.open();
  const client = dynamicContentClientFactory(argv);
  const allWebhooks = !id;
  const hub = await client.hubs.get(argv.hubId);
  let ids: string[] = [];

  if (id) {
    ids = Array.isArray(id) ? id : [id];
  }

  const webhooksToDelete = ids.length > 0 ? await getWebhooksByIds(hub, ids) : await getAllWebhooks(hub);

  if (webhooksToDelete.length === 0) {
    nothingToDeleteExit(log, 'No webhooks to delete from this hub, exiting.');
    return;
  }

  if (!force) {
    const baseMessage = 'This action cannot be undone. Are you sure you want to continue? (Y/n)\n';
    const yes = await asyncQuestion(
      allWebhooks
        ? `Providing no ID/s will permanently delete ALL webhooks! ${baseMessage}`
        : `${webhooksToDelete.length} webhook/s will be permanently deleted. ${baseMessage}`
    );
    if (!yes) {
      return;
    }
  }

  log.addComment(`Deleting ${webhooksToDelete.length} webhook/s.`);

  const { failedWebhooks } = await processWebhooks(webhooksToDelete, log);

  const failedWebhooksMessage = failedWebhooks.length
    ? `with ${failedWebhooks.length} failed webhooks - check logs for details`
    : ``;

  log.appendLine(`Webhooks delete complete ${failedWebhooksMessage}`);

  await log.close();
};
