import * as deleteModule from './delete';
import Yargs from 'yargs/yargs';
import { builder, coerceLog, LOG_FILENAME, command, handler } from './delete';
import { getDefaultLogPath } from '../../common/log-helpers';
import { Extension } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { FileLog } from '../../common/file-log';
import { filterExtensionsById } from '../../common/extension/extension-helpers';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../common/log-helpers');

describe('delete extensions', () => {
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
          'The ID of a the extension to be deleted. If id is not provided, this command will delete ALL extensions in the hub.',
        type: 'string'
      });
      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before deleting the found extensions.'
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

    const extensionsToDelete: Extension[] = [
      new Extension({
        id: 'extension-id-1',
        name: 'extension-name-1',
        label: 'extension-label-1',
        status: 'ACTIVE'
      }),
      new Extension({
        id: 'extension-id-2',
        name: 'extension-name-2',
        label: 'extension-label-2',
        status: 'ACTIVE'
      })
    ];

    let mockGetHub: jest.Mock;
    let mockList: jest.Mock;

    const extensionIdsToDelete = (id: unknown) => (id ? (Array.isArray(id) ? id : [id]) : []);

    beforeEach((): void => {
      const listResponse = new MockPage(Extension, extensionsToDelete);
      mockList = jest.fn().mockResolvedValue(listResponse);

      mockGetHub = jest.fn().mockResolvedValue({
        related: {
          extensions: {
            list: mockList
          }
        }
      });

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });

      jest.spyOn(deleteModule, 'processExtensions').mockResolvedValue();
    });

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function () {
      LOG_FILENAME();
      expect(getDefaultLogPath).toHaveBeenCalledWith('extension', 'delete', process.platform);
    });

    it('should delete all extensions in a hub', async (): Promise<void> => {
      const id: string[] | undefined = undefined;
      const allExtensions = !id;
      const argv = { ...yargArgs, ...config, id, logFile: new FileLog() };

      const filteredExtensionsToDelete = filterExtensionsById(extensionsToDelete, extensionIdsToDelete(id));

      jest.spyOn(deleteModule, 'handler');

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalledTimes(1);
      expect(mockList).toHaveBeenCalledWith({ size: 100 });

      expect(deleteModule.processExtensions).toHaveBeenCalledWith(
        filteredExtensionsToDelete,
        allExtensions,
        argv.logFile,
        false
      );
    });

    it('should delete an extension by id', async (): Promise<void> => {
      const id: string[] | undefined = ['extension-id-2'];
      const allExtensions = !id;
      const argv = {
        ...yargArgs,
        ...config,
        id,
        logFile: new FileLog()
      };

      const filteredExtensionsToDelete = filterExtensionsById(extensionsToDelete, extensionIdsToDelete(id));

      jest.spyOn(deleteModule, 'handler');

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalledTimes(1);

      expect(deleteModule.processExtensions).toHaveBeenCalledWith(
        filteredExtensionsToDelete,
        allExtensions,
        argv.logFile,
        false
      );
    });
  });
});
