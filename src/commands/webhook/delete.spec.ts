import * as deleteModule from './delete';
import Yargs from 'yargs/yargs';
import { builder, coerceLog, LOG_FILENAME, command, handler } from './delete';
import { getDefaultLogPath } from '../../common/log-helpers';
import { Webhook } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { FileLog } from '../../common/file-log';
import * as questionHelpers from '../../common/question-helpers';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../common/log-helpers');
jest.mock('../../common/question-helpers');

describe('delete webhooks', () => {
  it('should implement an export command', () => {
    expect(command).toEqual('delete [id]');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        describe:
          'The ID of the webhook to be deleted. If id is not provided, this command will delete ALL webhooks in the hub.',
        type: 'string'
      });
      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before deleting the found webhooks.'
      });
      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: coerceLog
      });
    });
  });

  describe('handler tests', () => {
    const yargArgs = {
      $0: 'test',
      _: ['test']
    };

    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    const webhooksToDelete: Webhook[] = [
      new Webhook({
        id: 'webhook-id-1',
        label: 'webhook-label-1'
      }),
      new Webhook({
        id: 'webhook-id-2',
        label: 'webhook-label-2'
      })
    ];

    let mockGetHub: jest.Mock;
    let mockList: jest.Mock;
    let mockGet: jest.Mock;

    beforeEach((): void => {
      const listResponse = new MockPage(Webhook, webhooksToDelete);
      mockList = jest.fn().mockResolvedValue(listResponse);
      mockGet = jest.fn().mockResolvedValue(webhooksToDelete[1]);

      mockGetHub = jest.fn().mockResolvedValue({
        related: {
          webhooks: {
            list: mockList,
            get: mockGet
          }
        }
      });

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });

      jest.spyOn(deleteModule, 'processWebhooks').mockResolvedValue({ failedWebhooks: [] });
    });

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function () {
      LOG_FILENAME();
      expect(getDefaultLogPath).toHaveBeenCalledWith('webhook', 'delete', process.platform);
    });

    it('should delete all webhooks in a hub', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, logFile: new FileLog() };

      jest.spyOn(deleteModule, 'handler');

      (questionHelpers.asyncQuestion as jest.Mock).mockResolvedValue(true);

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalledTimes(1);
      expect(mockList).toHaveBeenCalledWith({ size: 100 });

      expect(deleteModule.processWebhooks).toHaveBeenCalledWith(webhooksToDelete, argv.logFile);
    });

    it('should delete a webhook by id', async (): Promise<void> => {
      const id: string[] | undefined = ['webhook-id-2'];
      const argv = {
        ...yargArgs,
        ...config,
        id,
        logFile: new FileLog()
      };

      jest.spyOn(deleteModule, 'handler');

      (questionHelpers.asyncQuestion as jest.Mock).mockResolvedValue(true);

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockGet).toHaveBeenCalledTimes(1);

      expect(deleteModule.processWebhooks).toHaveBeenCalledWith([webhooksToDelete[1]], argv.logFile);
    });
  });
});
