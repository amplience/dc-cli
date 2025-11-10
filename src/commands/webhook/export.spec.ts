import Yargs from 'yargs/yargs';
import * as exportWebhooksModule from './export';
import { builder, command, handler, LOG_FILENAME } from './export';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import readline from 'readline';
import rmdir from 'rimraf';
import { FileLog } from '../../common/file-log';
import { Webhook } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { existsSync } from 'fs';

jest.mock('readline');
jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../common/log-helpers');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('webhook export command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function () {
    expect(command).toEqual('export <dir>');
  });

  it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function () {
    LOG_FILENAME();

    expect(getDefaultLogPath).toHaveBeenCalledWith('webhook', 'export', process.platform);
  });

  describe('builder tests', function () {
    it('should configure yargs', function () {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        type: 'string',
        describe:
          'The id of a the webhook to be exported. If id is not provided, this command will export ALL webhooks in the hub.'
      });

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Output directory for the exported webhooks',
        type: 'string',
        requiresArg: true
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: createLog
      });
    });
  });

  describe('handler tests', function () {
    const yargArgs = {
      $0: 'test',
      _: ['test'],
      json: true
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id',
      logFile: new FileLog()
    };

    const webhooksToExport: Webhook[] = [
      new Webhook({
        id: '1',
        label: 'WH1',
        events: ['dynamic-content.content-item.updated'],
        active: true,
        handlers: ['https://test.this/webhook'],
        secret: 'xxxx',
        method: 'POST'
      }),
      new Webhook({
        id: '2',
        label: 'WH2',
        events: ['dynamic-content.content-item.updated'],
        active: true,
        handlers: ['https://test.this/webhook'],
        secret: 'xxxx',
        method: 'POST'
      })
    ];

    beforeAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/`);
    });

    let mockGetHub: jest.Mock;
    let mockList: jest.Mock;

    beforeEach((): void => {
      const listResponse = new MockPage(Webhook, webhooksToExport);
      mockList = jest.fn().mockResolvedValue(listResponse);

      mockGetHub = jest.fn().mockResolvedValue({
        related: {
          webhooks: {
            list: mockList
          }
        }
      });

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });
    });

    it('should export all webhooks to specified directory', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const id: string[] | undefined = undefined;

      const argv = {
        ...yargArgs,
        ...config,
        id,
        logFile: new FileLog(),
        dir: `temp_${process.env.JEST_WORKER_ID}/export/`
      };

      jest.spyOn(exportWebhooksModule, 'handler');
      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalledTimes(1);
      expect(mockList).toHaveBeenCalledWith({ size: 100 });

      const spy = jest.spyOn(exportWebhooksModule, 'exportWebhooks');
      await exportWebhooksModule.exportWebhooks(webhooksToExport, argv.dir, argv.logFile);

      expect(spy).toHaveBeenCalledWith(webhooksToExport, argv.dir, argv.logFile);

      webhooksToExport.forEach(webhook => {
        const path = `temp_${process.env.JEST_WORKER_ID}/export/exported_webhooks/${webhook.label}.json`;

        expect(existsSync(path)).toBe(true);
      });

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/exported_webhooks/`);

      spy.mockRestore();
    });
  });
});
