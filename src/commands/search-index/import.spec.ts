import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { SearchIndex, Hub } from 'dc-management-sdk-js';
import * as importModule from './import';
import {
  builder,
  command,
  doCreate,
  doUpdate,
  handler,
  LOG_FILENAME,
  processIndices,
  storedIndexMapper,
  validateNoDuplicateIndexNames
} from './import';
import Yargs from 'yargs/yargs';
import { table } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { loadJsonFromDirectory, UpdateStatus } from '../../services/import.service';
import chalk from 'chalk';
import { FileLog } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { EnrichedSearchIndex } from './export';
import MockPage from '../../common/dc-management-sdk-js/mock-page';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');
jest.mock('../../services/import.service');
jest.mock('fs');
jest.mock('table');
jest.mock('../../common/log-helpers');

describe('search-index import command', (): void => {
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
        describe: 'Directory containing Search Indices',
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

  describe('storedIndexMapper', () => {
    it('it should map to a stored index', () => {
      const importedIndex = new EnrichedSearchIndex({
        name: 'matched-name',
        label: 'mutated-label'
      });
      const storedIndex = [new SearchIndex({ id: 'stored-id', name: 'matched-name', label: 'label' })];
      const result = storedIndexMapper(importedIndex, storedIndex);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'stored-id',
          name: 'matched-name',
          label: 'mutated-label'
        })
      );
    });

    it('should not map to a stored index', () => {
      const importedIndex = new EnrichedSearchIndex({
        name: 'not-matched-name',
        label: 'mutated-label'
      });
      const storedIndex = [new SearchIndex({ id: 'stored-id', name: 'matched-name', label: 'label' })];
      const result = storedIndexMapper(importedIndex, storedIndex);

      expect(result).toEqual(expect.objectContaining({ name: 'not-matched-name', label: 'mutated-label' }));
    });
  });

  describe('doCreate', () => {
    it('should create a index and return report', async () => {
      const mockHub = new Hub();
      const log = new FileLog();
      const newIndex = new SearchIndex({ id: 'created-id' });
      const mockCreate = jest.fn().mockResolvedValue(newIndex);
      mockHub.related.searchIndexes.create = mockCreate;
      jest.spyOn(importModule, 'enrichIndex').mockResolvedValue();
      const index = { name: 'index-name', label: 'test-label' };
      const result = await doCreate(mockHub, index as EnrichedSearchIndex, log);

      expect(log.getData('CREATE')).toMatchInlineSnapshot(`
        Array [
          "created-id",
        ]
      `);
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining(index));
      expect(importModule.enrichIndex).toHaveBeenCalledWith(newIndex, index);
      expect(result).toEqual(newIndex);
    });

    it('should throw an error when index create fails', async () => {
      const mockHub = new Hub();
      const log = new FileLog();
      jest.spyOn(importModule, 'enrichIndex').mockResolvedValue();
      const mockCreate = jest.fn().mockImplementation(() => {
        throw new Error('Error creating index');
      });
      mockHub.related.searchIndexes.create = mockCreate;
      const index = { name: 'index-name', label: 'test-label' };

      await expect(doCreate(mockHub, index as EnrichedSearchIndex, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(importModule.enrichIndex).not.toHaveBeenCalled();
      expect(log.getData('CREATE')).toEqual([]);
    });

    it('should throw an error when index create fails if a string error is returned by the sdk', async () => {
      const mockHub = new Hub();
      const log = new FileLog();
      jest.spyOn(importModule, 'enrichIndex').mockResolvedValue();
      const mockCreate = jest
        .fn()
        .mockRejectedValue(
          'The create-index action is not available, ensure you have permission to perform this action.'
        );
      mockHub.related.searchIndexes.create = mockCreate;
      const index = { name: 'index-name', label: 'test-label' };

      await expect(doCreate(mockHub, index as EnrichedSearchIndex, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(importModule.enrichIndex).not.toHaveBeenCalled();
      expect(log.getData('CREATE')).toEqual([]);
    });

    it('should throw an error when enrichIndex fails', async () => {
      const mockHub = new Hub();
      const log = new FileLog();
      const newIndex = new SearchIndex({ id: 'created-id' });
      const mockCreate = jest.fn().mockResolvedValue(newIndex);
      mockHub.related.searchIndexes.create = mockCreate;
      jest
        .spyOn(importModule, 'enrichIndex')
        .mockRejectedValue(
          'The update-index action is not available, ensure you have permission to perform this action.'
        );
      const index = { name: 'index-name', label: 'test-label' };

      await expect(doCreate(mockHub, index as EnrichedSearchIndex, log)).rejects.toThrowErrorMatchingSnapshot();

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining(index));
      expect(importModule.enrichIndex).toHaveBeenCalledWith(newIndex, index);
      expect(log.getData('CREATE')).toEqual([]);
    });
  });

  describe('processIndices', () => {
    let mockTable: jest.Mock;

    beforeEach(() => {
      mockTable = table as jest.Mock;
      mockTable.mockImplementation(jest.requireActual('table').table);
    });

    it('should create and update a index', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const hub = new Hub();
      const indicesToProcess = [
        new EnrichedSearchIndex({
          name: 'index-name',
          label: 'created',
          assignedContentTypes: []
        }),
        new EnrichedSearchIndex({
          id: 'updated-id',
          name: 'index-name-2',
          label: 'updated'
        }),
        new EnrichedSearchIndex({
          id: 'up-to-date-id',
          name: 'index-name-3',
          label: 'up-to date'
        })
      ];

      const createdIndex = new EnrichedSearchIndex({
        id: 'created-id',
        ...indicesToProcess[0].toJSON()
      });
      jest.spyOn(importModule, 'doCreate').mockResolvedValueOnce(createdIndex);
      const doUpdateResult1 = {
        index: indicesToProcess[1],
        updateStatus: UpdateStatus.UPDATED
      };
      jest.spyOn(importModule, 'doUpdate').mockResolvedValueOnce(doUpdateResult1);
      const doUpdateResult2 = {
        index: indicesToProcess[2],
        updateStatus: UpdateStatus.SKIPPED
      };
      jest.spyOn(importModule, 'doUpdate').mockResolvedValueOnce(doUpdateResult2);

      await processIndices(indicesToProcess, new Map(), client, hub, new FileLog());

      expect(importModule.doCreate).toHaveBeenCalledWith(hub, indicesToProcess[0], expect.any(FileLog));
      expect(importModule.doUpdate).toHaveBeenCalledWith(
        hub,
        expect.any(Map),
        indicesToProcess[1],
        expect.any(FileLog)
      );

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('ID'), chalk.bold('Name'), chalk.bold('Result')],
          [createdIndex.id, createdIndex.name, 'CREATED'],
          [doUpdateResult1.index.id, doUpdateResult1.index.name, 'UPDATED'],
          [doUpdateResult2.index.id, doUpdateResult2.index.name, 'UP-TO-DATE']
        ],
        streamTableOptions
      );
    });
  });

  describe('validateNoDuplicateIndexNames', function() {
    it('should not throw an error when there are no duplicates', () => {
      const indicesToProcess = {
        'file-1': new EnrichedSearchIndex({
          name: 'index-name-1'
        }),
        'file-2': new EnrichedSearchIndex({
          name: 'index-name-2'
        })
      };

      expect(() => validateNoDuplicateIndexNames(indicesToProcess)).not.toThrow();
    });

    it('should throw and error when there are duplicate uris', () => {
      const indicesToProcess = {
        'file-1': new EnrichedSearchIndex({
          name: 'index-name-1'
        }),
        'file-2': new EnrichedSearchIndex({
          name: 'index-name-2'
        }),
        'file-3': new EnrichedSearchIndex({
          name: 'index-name-2'
        }),
        'file-4': new EnrichedSearchIndex({
          name: 'index-name-1'
        })
      };

      expect(() => validateNoDuplicateIndexNames(indicesToProcess)).toThrowErrorMatchingSnapshot();
    });
  });

  describe('filterIndicesById', function() {
    it('should delete indices without a matching id', () => {
      const indicesToProcess = {
        'file-1': new EnrichedSearchIndex({
          id: 'index-id-1',
          name: 'index-name-1'
        }),
        'file-2': new EnrichedSearchIndex({
          id: 'index-id-2',
          name: 'index-name-2'
        })
      };

      const expectedResult = { 'file-2': indicesToProcess['file-2'] };

      importModule.filterIndicesById(['index-id-2'], indicesToProcess);

      expect(indicesToProcess).toEqual(expectedResult);
    });

    it('should remove all indices if no ids are given', () => {
      const indicesToProcess = {
        'file-1': new EnrichedSearchIndex({
          id: 'index-id-1',
          name: 'index-name-1'
        }),
        'file-2': new EnrichedSearchIndex({
          id: 'index-id-2',
          name: 'index-name-2'
        })
      };

      importModule.filterIndicesById([], indicesToProcess);

      expect(indicesToProcess).toEqual({});
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
    const mockList = jest.fn();

    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });

      mockGetHub.mockResolvedValue({
        id: 'hub-id',
        related: {
          searchIndexes: {
            list: mockList
          }
        }
      });

      mockList.mockImplementation(() => {
        return Promise.resolve(
          new MockPage<SearchIndex>(SearchIndex, [
            new SearchIndex({
              id: 'id',
              label: 'label',
              name: 'stored-index'
            })
          ])
        );
      });
    });

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function() {
      LOG_FILENAME();

      expect(getDefaultLogPath).toHaveBeenCalledWith('search-index', 'import', process.platform);
    });

    it('should create a index and update', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', logFile: new FileLog() };
      const fileNamesAndIndicesToImport = {
        'file-1': new EnrichedSearchIndex({
          name: 'index-name-1',
          label: 'created'
        }),
        'file-2': new EnrichedSearchIndex({
          id: 'content-index-id',
          name: 'index-name-2',
          label: 'updated'
        })
      };

      (loadJsonFromDirectory as jest.Mock).mockReturnValue(fileNamesAndIndicesToImport);
      jest
        .spyOn(importModule, 'storedIndexMapper')
        .mockReturnValueOnce(fileNamesAndIndicesToImport['file-1'])
        .mockReturnValueOnce(fileNamesAndIndicesToImport['file-2']);
      jest.spyOn(importModule, 'processIndices').mockResolvedValueOnce();

      await handler(argv);

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('my-dir', EnrichedSearchIndex);
      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalled();
      expect(processIndices).toHaveBeenCalledWith(
        Object.values(fileNamesAndIndicesToImport),
        expect.any(Map),
        expect.any(Object),
        expect.any(Object),
        expect.any(FileLog)
      );
    });

    it('should call filterIndicesById when a list of ids is provided', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', logFile: new FileLog() };
      const fileNamesAndIndicesToImport = {
        'file-1': new EnrichedSearchIndex({
          id: 'index-id-1',
          name: 'index-name-1',
          label: 'created'
        }),
        'file-2': new EnrichedSearchIndex({
          id: 'index-id-2',
          name: 'index-name-2',
          label: 'updated'
        })
      };

      (loadJsonFromDirectory as jest.Mock).mockReturnValue({ ...fileNamesAndIndicesToImport });
      jest.spyOn(importModule, 'storedIndexMapper').mockReturnValueOnce(fileNamesAndIndicesToImport['file-2']);
      jest.spyOn(importModule, 'processIndices').mockResolvedValueOnce();

      await handler(argv, ['index-id-2']);

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('my-dir', EnrichedSearchIndex);
      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(processIndices).toHaveBeenCalledWith(
        [fileNamesAndIndicesToImport['file-2']],
        expect.any(Map),
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
