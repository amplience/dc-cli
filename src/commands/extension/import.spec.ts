import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Extension, Hub } from 'dc-management-sdk-js';
import * as importModule from './import';
import {
  builder,
  command,
  doCreate,
  doUpdate,
  handler,
  LOG_FILENAME,
  processExtensions,
  storedExtensionMapper,
  validateNoDuplicateExtensionNames
} from './import';
import Yargs from 'yargs/yargs';
import { table } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { loadJsonFromDirectory, UpdateStatus } from '../../services/import.service';
import chalk from 'chalk';
import { FileLog } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');
jest.mock('../../services/import.service');
jest.mock('../../common/dc-management-sdk-js/paginator');
jest.mock('fs');
jest.mock('table');
jest.mock('../../common/log-helpers');

describe('extension import command', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should implement an import command', () => {
    expect(command).toEqual('import <dir>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Directory containing Extensions',
        type: 'string'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: createLog
      });
    });
  });

  describe('storedExtensionMapper', () => {
    it('it should map to a stored extension', () => {
      const importedExtension = new Extension({
        name: 'matched-name',
        label: 'mutated-label'
      });
      const storedExtension = [new Extension({ id: 'stored-id', name: 'matched-name', label: 'label' })];
      const result = storedExtensionMapper(importedExtension, storedExtension);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'stored-id',
          name: 'matched-name',
          label: 'mutated-label'
        })
      );
    });

    it('should not map to a stored extension', () => {
      const importedExtension = new Extension({
        name: 'not-matched-name',
        label: 'mutated-label'
      });
      const storedExtension = [new Extension({ id: 'stored-id', name: 'matched-name', label: 'label' })];
      const result = storedExtensionMapper(importedExtension, storedExtension);

      expect(result).toEqual(expect.objectContaining({ name: 'not-matched-name', label: 'mutated-label' }));
    });
  });

  describe('doCreate', () => {
    it('should create a extension and return report', async () => {
      const mockHub = new Hub();
      const log = new FileLog();
      const newExtension = new Extension({ id: 'created-id' });
      const mockCreate = jest.fn().mockResolvedValue(newExtension);
      mockHub.related.extensions.create = mockCreate;
      const extension = { name: 'extension-name', label: 'test-label' };
      const result = await doCreate(mockHub, extension as Extension, log);

      expect(log.getData('CREATE')).toMatchInlineSnapshot(`
        Array [
          "created-id",
        ]
      `);
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining(extension));
      expect(result).toEqual(newExtension);
    });

    it('should throw an error when extension create fails', async () => {
      const mockHub = new Hub();
      const log = new FileLog();
      const mockCreate = jest.fn().mockImplementation(() => {
        throw new Error('Error creating extension');
      });
      mockHub.related.extensions.create = mockCreate;
      const extension = { name: 'extension-name', label: 'test-label' };

      await expect(doCreate(mockHub, extension as Extension, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('UPDATE')).toEqual([]);
    });

    it('should throw an error when extension create fails if a string error is returned by the sdk', async () => {
      const mockHub = new Hub();
      const log = new FileLog();
      const mockCreate = jest
        .fn()
        .mockRejectedValue(
          'The create-extension action is not available, ensure you have permission to perform this action.'
        );
      mockHub.related.extensions.create = mockCreate;
      const extension = { name: 'extension-name', label: 'test-label' };

      await expect(doCreate(mockHub, extension as Extension, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('UPDATE')).toEqual([]);
    });
  });

  describe('doUpdate', () => {
    const mockGet = jest.fn();
    let mockDynamicContentClientFactory: jest.Mock;

    beforeEach(() => {
      mockDynamicContentClientFactory = (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        extensions: {
          get: mockGet
        }
      });
    });
    it('should update a extension and return report', async () => {
      const mutatedExtension = {
        id: 'stored-id',
        name: 'not-matched-name',
        label: 'mutated-label'
      } as Extension;
      const storedExtension = new Extension({
        id: 'stored-id',
        name: 'matched-name',
        label: 'label'
      });
      const expectedExtension = new Extension({
        id: 'stored-id',
        name: 'not-matched-name',
        label: 'mutated-label'
      });
      mockGet.mockResolvedValue(storedExtension);

      const updatedExtension = new Extension(mutatedExtension);
      const mockUpdate = jest.fn().mockResolvedValue(updatedExtension);
      storedExtension.related.update = mockUpdate;
      const client = mockDynamicContentClientFactory();
      const log = new FileLog();
      const result = await doUpdate(client, mutatedExtension, log);

      expect(log.getData('UPDATE')).toMatchInlineSnapshot(`
        Array [
          "stored-id",
        ]
      `);
      expect(result).toEqual({ extension: updatedExtension, updateStatus: UpdateStatus.UPDATED });
      expect(mockUpdate).toHaveBeenCalledWith(expectedExtension.toJSON());
    });

    it('should skip update when no change to extension and return report', async () => {
      const mutatedExtension = new Extension({
        id: 'stored-id',
        name: 'matched-name',
        label: 'label'
      });
      const storedExtension = new Extension({
        id: 'stored-id',
        name: 'matched-name',
        label: 'label'
      });
      mockGet.mockResolvedValue(storedExtension);
      const client = mockDynamicContentClientFactory();
      const log = new FileLog();
      const result = await doUpdate(client, mutatedExtension, log);

      expect(result).toEqual({ extension: storedExtension, updateStatus: UpdateStatus.SKIPPED });
      expect(log.getData('UPDATE')).toEqual([]);
    });

    it('should throw an error when unable to get extension during update', async () => {
      const mutatedExtension = {
        id: 'stored-id',
        name: 'matched-name',
        label: 'label'
      } as Extension;
      mockGet.mockImplementation(() => {
        throw new Error('Error retrieving extension');
      });
      const client = mockDynamicContentClientFactory();
      const log = new FileLog();

      await expect(doUpdate(client, mutatedExtension, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('UPDATE')).toEqual([]);
    });

    it('should throw an error when unable to update extension during update if a string error is returned by sdk', async () => {
      const mutatedExtension = new Extension({
        id: 'stored-id',
        name: 'not-matched-name',
        label: 'mutated-label'
      });
      const storedExtension = new Extension({
        id: 'stored-id',
        name: 'matched-name',
        label: 'label'
      });
      const mockUpdate = jest
        .fn()
        .mockRejectedValue('The update action is not available, ensure you have permission to perform this action.');
      storedExtension.related.update = mockUpdate;
      mockGet.mockResolvedValue(storedExtension);
      const client = mockDynamicContentClientFactory();
      const log = new FileLog();
      await expect(doUpdate(client, mutatedExtension, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('UPDATE')).toEqual([]);
      expect(mockUpdate).toHaveBeenCalledWith(mutatedExtension);
    });

    it('should throw an error when unable to update extension during update', async () => {
      const mutatedExtension = new Extension({
        id: 'stored-id',
        name: 'not-matched-name',
        label: 'mutated-label'
      });
      const storedExtension = new Extension({
        id: 'stored-id',
        name: 'matched-name',
        label: 'label'
      });
      const mockUpdate = jest.fn().mockRejectedValue(new Error('Error saving extension'));
      storedExtension.related.update = mockUpdate;
      mockGet.mockResolvedValue(storedExtension);
      const client = mockDynamicContentClientFactory();
      const log = new FileLog();
      await expect(doUpdate(client, mutatedExtension, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('UPDATE')).toEqual([]);
      expect(mockUpdate).toHaveBeenCalledWith(mutatedExtension);
    });
  });

  describe('processExtensions', () => {
    let mockTable: jest.Mock;

    beforeEach(() => {
      mockTable = table as jest.Mock;
      mockTable.mockImplementation(jest.requireActual('table').table);
    });

    it('should create and update a extension', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const hub = new Hub();
      const extensionsToProcess = [
        new Extension({
          name: 'extension-name',
          label: 'created'
        }),
        new Extension({
          id: 'updated-id',
          name: 'extension-name-2',
          label: 'updated'
        }),
        new Extension({
          id: 'up-to-date-id',
          name: 'extension-name-3',
          label: 'up-to date'
        })
      ];

      const createdExtension = new Extension({
        id: 'created-id',
        ...extensionsToProcess[0].toJSON()
      });
      jest.spyOn(importModule, 'doCreate').mockResolvedValueOnce(createdExtension);
      const doUpdateResult1 = {
        extension: extensionsToProcess[1],
        updateStatus: UpdateStatus.UPDATED
      };
      jest.spyOn(importModule, 'doUpdate').mockResolvedValueOnce(doUpdateResult1);
      const doUpdateResult2 = {
        extension: extensionsToProcess[2],
        updateStatus: UpdateStatus.SKIPPED
      };
      jest.spyOn(importModule, 'doUpdate').mockResolvedValueOnce(doUpdateResult2);

      await processExtensions(extensionsToProcess, client, hub, new FileLog());

      expect(importModule.doCreate).toHaveBeenCalledWith(hub, extensionsToProcess[0], expect.any(FileLog));
      expect(importModule.doUpdate).toHaveBeenCalledWith(client, extensionsToProcess[1], expect.any(FileLog));

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('ID'), chalk.bold('Name'), chalk.bold('Result')],
          [createdExtension.id, createdExtension.name, 'CREATED'],
          [doUpdateResult1.extension.id, doUpdateResult1.extension.name, 'UPDATED'],
          [doUpdateResult2.extension.id, doUpdateResult2.extension.name, 'UP-TO-DATE']
        ],
        streamTableOptions
      );
    });
  });

  describe('validateNoDuplicateExtensionNames', function() {
    it('should not throw an error when there are no duplicates', () => {
      const extensionsToProcess = {
        'file-1': new Extension({
          name: 'extension-name-1'
        }),
        'file-2': new Extension({
          name: 'extension-name-2'
        })
      };

      expect(() => validateNoDuplicateExtensionNames(extensionsToProcess)).not.toThrow();
    });

    it('should throw and error when there are duplicate uris', () => {
      const extensionsToProcess = {
        'file-1': new Extension({
          name: 'extension-name-1'
        }),
        'file-2': new Extension({
          name: 'extension-name-2'
        }),
        'file-3': new Extension({
          name: 'extension-name-2'
        }),
        'file-4': new Extension({
          name: 'extension-name-1'
        })
      };

      expect(() => validateNoDuplicateExtensionNames(extensionsToProcess)).toThrowErrorMatchingSnapshot();
    });
  });

  describe('filterExtensionsById', function() {
    it('should delete extensions without a matching id', () => {
      const extensionsToProcess = {
        'file-1': new Extension({
          id: 'extension-id-1',
          name: 'extension-name-1'
        }),
        'file-2': new Extension({
          id: 'extension-id-2',
          name: 'extension-name-2'
        })
      };

      const expectedResult = { 'file-2': extensionsToProcess['file-2'] };

      importModule.filterExtensionsById(['extension-id-2'], extensionsToProcess);

      expect(extensionsToProcess).toEqual(expectedResult);
    });

    it('should remove all extensions if no ids are given', () => {
      const extensionsToProcess = {
        'file-1': new Extension({
          id: 'extension-id-1',
          name: 'extension-name-1'
        }),
        'file-2': new Extension({
          id: 'extension-id-2',
          name: 'extension-name-2'
        })
      };

      importModule.filterExtensionsById([], extensionsToProcess);

      expect(extensionsToProcess).toEqual({});
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

    const mockGetHub = jest.fn();

    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });

      mockGetHub.mockResolvedValue({
        related: {
          extensions: {
            list: jest.fn()
          }
        }
      });
    });

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function() {
      LOG_FILENAME();

      expect(getDefaultLogPath).toHaveBeenCalledWith('extension', 'import', process.platform);
    });

    it('should create a extension and update', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', logFile: new FileLog() };
      const fileNamesAndExtensionsToImport = {
        'file-1': new Extension({
          name: 'extension-name-1',
          label: 'created'
        }),
        'file-2': new Extension({
          id: 'content-extension-id',
          name: 'extension-name-2',
          label: 'updated'
        })
      };

      (loadJsonFromDirectory as jest.Mock).mockReturnValue(fileNamesAndExtensionsToImport);
      mockGetHub.mockResolvedValue(new Hub({ id: 'hub-id' }));
      jest
        .spyOn(importModule, 'storedExtensionMapper')
        .mockReturnValueOnce(fileNamesAndExtensionsToImport['file-1'])
        .mockReturnValueOnce(fileNamesAndExtensionsToImport['file-2']);
      jest.spyOn(importModule, 'processExtensions').mockResolvedValueOnce();

      await handler(argv);

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('my-dir', Extension);
      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(processExtensions).toHaveBeenCalledWith(
        Object.values(fileNamesAndExtensionsToImport),
        expect.any(Object),
        expect.any(Object),
        expect.any(FileLog)
      );
    });

    it('should call filterExtensionsById when a list of ids is provided', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', logFile: new FileLog() };
      const fileNamesAndExtensionsToImport = {
        'file-1': new Extension({
          id: 'extension-id-1',
          name: 'extension-name-1',
          label: 'created'
        }),
        'file-2': new Extension({
          id: 'extension-id-2',
          name: 'extension-name-2',
          label: 'updated'
        })
      };

      (loadJsonFromDirectory as jest.Mock).mockReturnValue({ ...fileNamesAndExtensionsToImport });
      mockGetHub.mockResolvedValue(new Hub({ id: 'hub-id' }));
      jest.spyOn(importModule, 'storedExtensionMapper').mockReturnValueOnce(fileNamesAndExtensionsToImport['file-2']);
      jest.spyOn(importModule, 'processExtensions').mockResolvedValueOnce();

      await handler(argv, ['extension-id-2']);

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('my-dir', Extension);
      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(processExtensions).toHaveBeenCalledWith(
        [fileNamesAndExtensionsToImport['file-2']],
        expect.any(Object),
        expect.any(Object),
        expect.any(FileLog)
      );
    });

    it('should throw an error when no content found in import directory', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-empty-dir', logFile: new FileLog() };

      (loadJsonFromDirectory as jest.Mock).mockReturnValue([]);

      await expect(handler(argv)).rejects.toThrowErrorMatchingSnapshot();
    });
  });
});
