import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import { asyncQuestion } from '../../common/question-helpers';
import { nothingExportedExit, uniqueFilenamePath, writeJsonToFile } from '../../services/export.service';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { filterById } from '../../common/filter/filter';
import { Webhook } from 'dc-management-sdk-js';
import { FileLog } from '../../common/file-log';
import { join } from 'path';
import sanitize from 'sanitize-filename';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { progressBar } from '../../common/progress-bar/progress-bar';

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

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { id, logFile, dir } = argv;

  const client = dynamicContentClientFactory(argv);

  const allWebhooks = !id;

  const hub = await client.hubs.get(argv.hubId);

  const webhooks = await paginator(hub.related.webhooks.list);

  const idArray: string[] = id ? (Array.isArray(id) ? id : [id]) : [];
  const webhooksToExport = filterById<Webhook>(webhooks, idArray, undefined, 'webhooks');

  const log = logFile.open();

  if (webhooksToExport.length === 0) {
    nothingExportedExit(log, 'No webhooks to export from this hub, exiting.');
    return;
  }

  const yes = await asyncQuestion(
    allWebhooks
      ? `Providing no ID/s will export all webhooks! Are you sure you want to do this? (Y/n)\n`
      : `${webhooksToExport.length} webhooks will be exported. Would you like to continue? (Y/n)\n`
  );
  if (!yes) {
    return;
  }

  log.addComment(`Exporting ${webhooksToExport.length} webhooks.`);

  await exportWebhooks(webhooksToExport, dir, log);

  log.appendLine(`Finished successfully exporting ${webhooksToExport.length} webhooks`);

  await log.close();
};
