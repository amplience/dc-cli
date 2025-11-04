import { builder, command, getDefaultMappingPath, handler, LOG_FILENAME } from './import';
import * as importModule from './import';
import { Hub, Webhook } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import rmdir from 'rimraf';
import { FileLog } from '../../common/file-log';
import { ContentMapping } from '../../common/content-mapping';
import { mockValues } from './webhook-test-helpers';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { exportWebhooks } from './export';
import readline from 'readline';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../services/import.service');
jest.mock('readline');

jest.mock('../../common/log-helpers', () => ({
  ...jest.requireActual('../../common/log-helpers'),
  getDefaultLogPath: jest.fn()
}));

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('webhook import command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function () {
    expect(command).toEqual('import <dir>');
  });

  it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function () {
    LOG_FILENAME();

    expect(getDefaultLogPath).toHaveBeenCalledWith('webhook', 'import', process.platform);
  });

  it('should generate a default mapping path containing the given name', function () {
    expect(getDefaultMappingPath('hub-1').indexOf('hub-1')).not.toEqual(-1);
  });

  describe('builder tests', function () {
    it('should configure yargs', function () {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Directory containing webhooks to import.',
        type: 'string',
        requiresArg: true
      });

      expect(spyOption).toHaveBeenCalledWith('mapFile', {
        type: 'string',
        describe:
          'Mapping file to use when updating webhooks that already exists. Updated with any new mappings that are generated. If not present, will be created.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: createLog
      });

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'Overwrite webhooks.'
      });

      expect(spyOption).toHaveBeenCalledWith('s', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, no log file will be produced.'
      });
    });
  });

  describe('handler tests', function () {
    beforeAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/importWebhook/`);
    });

    afterAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/importWebhook/`);
    });

    it('should call importWebhooks with the loaded webhook, then save the mapping', async function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { getHubMock } = mockValues({});
      const logFile = new FileLog();

      const yargArgs = {
        $0: 'test',
        _: ['test'],
        json: true
      };
      const config = {
        clientId: 'client-id',
        clientSecret: 'client-id',
        hubId: 'hub-1',
        logFile
      };

      const webhookObj = {
        id: '1',
        label: 'WH1',
        events: ['dynamic-content.content-item.updated'],
        active: true,
        handlers: ['https://test.this/webhook'],
        method: 'POST'
      };

      const webhooks = [new Webhook(webhookObj)];

      await exportWebhooks(webhooks, `temp_${process.env.JEST_WORKER_ID}/importWebhook/`, logFile);

      const importWebhooks = jest.spyOn(importModule, 'importWebhooks').mockResolvedValue(true);
      const trySaveMapping = jest.spyOn(importModule, 'trySaveMapping').mockResolvedValue();

      const getDefaultMappingPathSpy = jest.spyOn(importModule, 'getDefaultMappingPath');
      const mappingPath = importModule.getDefaultMappingPath('hub-1');

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/importWebhook/exported_webhooks`
      };

      await handler(argv);

      expect(getHubMock).toHaveBeenCalledWith('hub-1');

      expect(importWebhooks).toHaveBeenCalledWith(
        expect.any(Hub),
        expect.arrayContaining([expect.objectContaining(webhookObj)]),
        expect.any(ContentMapping),
        logFile
      );

      expect(getDefaultMappingPathSpy).toHaveBeenCalledWith('hub-1');

      expect(trySaveMapping).toHaveBeenCalledWith(
        expect.stringContaining('hub-1.json'),
        expect.any(ContentMapping),
        logFile
      );
      expect(logFile.closed).toBeTruthy();

      rimraf(mappingPath);
    });

    it('should load an existing mapping file', async function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { getHubMock } = mockValues({});
      const logFile = new FileLog();

      const yargArgs = {
        $0: 'test',
        _: ['test'],
        json: true
      };
      const config = {
        clientId: 'client-id',
        clientSecret: 'client-id',
        hubId: 'hub-1',
        logFile
      };

      const webhookObj = {
        id: '1',
        label: 'WH1',
        events: ['dynamic-content.content-item.updated'],
        active: true,
        handlers: ['https://test.this/webhook'],
        method: 'POST'
      };

      const webhooks = [new Webhook(webhookObj)];

      await exportWebhooks(webhooks, `temp_${process.env.JEST_WORKER_ID}/importWebhook/`, logFile);

      const argv = {
        ...yargArgs,
        ...config,
        logFile,
        mapFile: `temp_${process.env.JEST_WORKER_ID}/importWebhook/hub-1(existing-mapping).json`,
        dir: `temp_${process.env.JEST_WORKER_ID}/importWebhook/exported_webhooks`
      };

      const importWebhooks = jest.spyOn(importModule, 'importWebhooks').mockResolvedValue(true);
      const trySaveMapping = jest.spyOn(importModule, 'trySaveMapping').mockResolvedValue();

      const getDefaultMappingPathSpy = jest.spyOn(importModule, 'getDefaultMappingPath');

      await ensureDirectoryExists(`temp_${process.env.JEST_WORKER_ID}/importWebhook/`);

      const existingMapping = new ContentMapping();
      await existingMapping.save(argv.mapFile);

      await handler(argv);

      expect(getHubMock).toHaveBeenCalledWith('hub-1');

      expect(importWebhooks).toHaveBeenCalledWith(
        expect.any(Hub),
        expect.arrayContaining([expect.objectContaining(webhookObj)]),
        expect.any(ContentMapping),
        logFile
      );

      expect(getDefaultMappingPathSpy).not.toHaveBeenCalled();
      expect(trySaveMapping).toHaveBeenCalledWith(argv.mapFile, expect.any(ContentMapping), logFile);
      expect(logFile.closed).toBeTruthy();
    });
  });
});
