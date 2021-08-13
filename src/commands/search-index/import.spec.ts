import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { SearchIndex, Hub, Webhook } from 'dc-management-sdk-js';
import * as exportModule from './export';
import * as importModule from './import';
import * as webhookRewriter from './webhook-rewriter';
import {
  builder,
  command,
  doCreate,
  doUpdate,
  handler,
  loadAndRewriteWebhooks,
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
import { AssignedContentType } from 'dc-management-sdk-js/build/main/lib/model/AssignedContentType';

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

      expect(spyOption).toHaveBeenCalledWith('webhooks', {
        type: 'boolean',
        describe:
          'Import webhooks as well. The command will attempt to rewrite account names and staging environments in the webhook body to match the destination.',
        boolean: true
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

  describe('replicaList', () => {
    it('should return a function that lists the replicas for the given index, with the given projection', async () => {
      const replicas = new MockPage(SearchIndex, [new SearchIndex({ label: 'webhook1' })]);
      const index = new SearchIndex({ label: 'webhook1' });
      index.related.replicas.list = jest.fn().mockResolvedValue(replicas);

      const resultFn = await importModule.replicaList(index, 'projection');

      const noOptionsResult = await resultFn();
      expect(noOptionsResult).toEqual(replicas);
      expect(index.related.replicas.list).toHaveBeenCalledWith('projection', undefined);

      const optionsResult = await resultFn({ sort: 'sort' });
      expect(optionsResult).toEqual(replicas);
      expect(index.related.replicas.list).toHaveBeenCalledWith('projection', { sort: 'sort' });
    });

    it('should return a function that lists the replicas for the given index, with no projection', async () => {
      const replicas = new MockPage(SearchIndex, [new SearchIndex({ label: 'webhook1' })]);
      const index = new SearchIndex({ label: 'webhook1' });
      index.related.replicas.list = jest.fn().mockResolvedValue(replicas);

      const resultFn = await importModule.replicaList(index);

      const result = await resultFn();
      expect(result).toEqual(replicas);
      expect(index.related.replicas.list).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('updateWebhookIfDifferent', () => {
    it('should update the webhook if newWebhook is defined', async () => {
      const webhook = new Webhook({ label: 'webhook1' });
      webhook.related.update = jest.fn().mockResolvedValue(webhook);
      const newWebhook = new Webhook({ label: 'webhook2' });

      await importModule.updateWebhookIfDifferent(webhook, newWebhook);

      expect(webhook.related.update).toHaveBeenCalledWith(newWebhook);
    });

    it('should not update the webhook if newWebhook is undefined', async () => {
      const webhook = new Webhook({ label: 'webhook1' });
      webhook.related.update = jest.fn().mockResolvedValue(webhook);

      await importModule.updateWebhookIfDifferent(webhook, undefined);

      expect(webhook.related.update).not.toHaveBeenCalled();
    });
  });

  describe('doCreate', () => {
    const assignedContentType = new AssignedContentType({ contentTypeUri: 'http://uri.com' });
    const assignedContentTypes = [{ contentTypeUri: 'http://uri.com' }];

    it('should create an index and return report', async () => {
      const mockHub = new Hub();
      const log = new FileLog();
      const newIndex = new SearchIndex({ id: 'created-id' });
      const mockCreate = jest.fn().mockResolvedValue(newIndex);
      mockHub.related.searchIndexes.create = mockCreate;
      jest.spyOn(importModule, 'enrichIndex').mockResolvedValue();
      const indexBase = { name: 'index-name', label: 'test-label' };
      const index = { ...indexBase, assignedContentTypes: [assignedContentType] };
      const webhooks = new Map();
      const result = await doCreate(mockHub, index as EnrichedSearchIndex, webhooks, log);

      expect(log.getData('CREATE')).toMatchInlineSnapshot(`
        Array [
          "created-id",
        ]
      `);
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ ...indexBase, assignedContentTypes }));
      expect(importModule.enrichIndex).toHaveBeenCalledWith(newIndex, index, webhooks);
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
      const index = { name: 'index-name', label: 'test-label', assignedContentTypes: [assignedContentType] };

      await expect(
        doCreate(mockHub, index as EnrichedSearchIndex, new Map(), log)
      ).rejects.toThrowErrorMatchingSnapshot();
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
      const index = { name: 'index-name', label: 'test-label', assignedContentTypes: [assignedContentType] };

      await expect(
        doCreate(mockHub, index as EnrichedSearchIndex, new Map(), log)
      ).rejects.toThrowErrorMatchingSnapshot();
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
      const indexBase = { name: 'index-name', label: 'test-label' };
      const index = { ...indexBase, assignedContentTypes: [assignedContentType] };
      const webhooks = new Map();

      await expect(
        doCreate(mockHub, index as EnrichedSearchIndex, webhooks, log)
      ).rejects.toThrowErrorMatchingSnapshot();

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ ...indexBase, assignedContentTypes }));
      expect(importModule.enrichIndex).toHaveBeenCalledWith(newIndex, index, webhooks);
      expect(log.getData('CREATE')).toEqual([]);
    });
  });

  describe('doUpdate', () => {
    beforeEach(() => {
      /* ... */
    });

    it('should update an index and return report', async () => {
      const mutatedIndex = {
        id: 'stored-id',
        name: 'not-matched-name',
        label: 'mutated-label'
      } as EnrichedSearchIndex;
      const storedIndex = new SearchIndex({
        id: 'stored-id',
        name: 'matched-name',
        label: 'label'
      });
      const expectedIndex = new SearchIndex({
        id: 'stored-id',
        name: 'not-matched-name',
        label: 'mutated-label'
      });

      const updatedIndex = new SearchIndex(mutatedIndex);
      const mockUpdate = jest.fn().mockResolvedValue(updatedIndex);
      storedIndex.related.update = mockUpdate;

      const hub = new Hub();
      hub.related.searchIndexes.get = jest.fn().mockResolvedValue(storedIndex);

      const enrichedStoredIndex = new EnrichedSearchIndex(storedIndex);
      jest.spyOn(exportModule, 'enrichIndex').mockResolvedValueOnce(enrichedStoredIndex);
      jest.spyOn(importModule, 'getIndexProperties').mockReturnValueOnce(mutatedIndex);
      jest.spyOn(importModule, 'enrichIndex').mockResolvedValueOnce();

      const log = new FileLog();
      const webhooks = new Map();
      const replicas = new Map();
      const result = await doUpdate(hub, replicas, mutatedIndex, webhooks, log);

      expect(log.getData('UPDATE')).toMatchInlineSnapshot(`
        Array [
          "stored-id",
        ]
      `);
      expect(hub.related.searchIndexes.get).toHaveBeenCalledWith('stored-id');
      expect(exportModule.enrichIndex).toHaveBeenCalledWith(expect.any(Map), replicas, storedIndex);
      expect(importModule.enrichIndex).toHaveBeenCalledWith(updatedIndex, mutatedIndex, webhooks);
      expect(result).toEqual({ index: updatedIndex, updateStatus: UpdateStatus.UPDATED });
      expect(mockUpdate.mock.calls[0][0].toJSON()).toEqual(expectedIndex.toJSON());
    });

    it('should skip update when no change to index and return report', async () => {
      const mutatedIndex = new EnrichedSearchIndex({
        id: 'stored-id',
        name: 'matched-name',
        label: 'label',
        settings: {},
        assignedContentTypes: [],
        replicas: []
      });
      const storedIndex = new SearchIndex({
        id: 'stored-id',
        name: 'matched-name',
        label: 'label'
      });

      const hub = new Hub();
      hub.related.searchIndexes.get = jest.fn().mockResolvedValue(storedIndex);

      jest.spyOn(exportModule, 'enrichIndex').mockResolvedValueOnce(
        new EnrichedSearchIndex({
          ...storedIndex,
          settings: {},
          assignedContentTypes: [],
          replicas: []
        })
      );

      const log = new FileLog();
      const webhooks = new Map();
      const replicas = new Map();
      const result = await doUpdate(hub, replicas, mutatedIndex, webhooks, log);

      expect(hub.related.searchIndexes.get).toHaveBeenCalledWith('stored-id');
      expect(exportModule.enrichIndex).toHaveBeenCalledWith(expect.any(Map), replicas, storedIndex);
      expect(result).toEqual({ index: storedIndex, updateStatus: UpdateStatus.SKIPPED });
      expect(log.getData('UPDATE')).toEqual([]);
    });

    it('should throw an error when unable to get index during update', async () => {
      const mutatedIndex = {
        id: 'stored-id',
        name: 'matched-name',
        label: 'label'
      } as EnrichedSearchIndex;

      const hub = new Hub();
      hub.related.searchIndexes.get = jest.fn().mockImplementation(() => {
        throw new Error('Error retrieving index');
      });

      const log = new FileLog();
      const webhooks = new Map();
      const replicas = new Map();

      await expect(doUpdate(hub, replicas, mutatedIndex, webhooks, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(hub.related.searchIndexes.get).toHaveBeenCalledWith('stored-id');
      expect(log.getData('UPDATE')).toEqual([]);
    });

    it('should throw an error when unable to update index during update if a string error is returned by sdk', async () => {
      const mutatedIndex = {
        id: 'stored-id',
        name: 'not-matched-name',
        label: 'mutated-label'
      } as EnrichedSearchIndex;
      const storedIndex = new SearchIndex({
        id: 'stored-id',
        name: 'matched-name',
        label: 'label'
      });
      const expectedIndex = new SearchIndex({
        id: 'stored-id',
        name: 'not-matched-name',
        label: 'mutated-label'
      });

      const hub = new Hub();
      hub.related.searchIndexes.get = jest.fn().mockResolvedValue(storedIndex);

      const mockUpdate = jest
        .fn()
        .mockRejectedValue('The update action is not available, ensure you have permission to perform this action.');
      storedIndex.related.update = mockUpdate;

      const enrichedStoredIndex = new EnrichedSearchIndex(storedIndex);
      jest.spyOn(exportModule, 'enrichIndex').mockResolvedValueOnce(enrichedStoredIndex);
      jest.spyOn(importModule, 'getIndexProperties').mockReturnValueOnce(mutatedIndex);

      const log = new FileLog();
      const webhooks = new Map();
      const replicas = new Map();
      await expect(doUpdate(hub, replicas, mutatedIndex, webhooks, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(hub.related.searchIndexes.get).toHaveBeenCalledWith('stored-id');
      expect(exportModule.enrichIndex).toHaveBeenCalledWith(expect.any(Map), replicas, storedIndex);
      expect(log.getData('UPDATE')).toEqual([]);
      expect(mockUpdate.mock.calls[0][0].toJSON()).toEqual(expectedIndex.toJSON());
    });

    it('should throw an error when unable to update index during update', async () => {
      const mutatedIndex = {
        id: 'stored-id',
        name: 'not-matched-name',
        label: 'mutated-label'
      } as EnrichedSearchIndex;
      const storedIndex = new SearchIndex({
        id: 'stored-id',
        name: 'matched-name',
        label: 'label'
      });
      const expectedIndex = new SearchIndex({
        id: 'stored-id',
        name: 'not-matched-name',
        label: 'mutated-label'
      });

      const hub = new Hub();
      hub.related.searchIndexes.get = jest.fn().mockResolvedValue(storedIndex);

      const mockUpdate = jest.fn().mockRejectedValue(new Error('Error saving index'));
      storedIndex.related.update = mockUpdate;

      const enrichedStoredIndex = new EnrichedSearchIndex(storedIndex);
      jest.spyOn(exportModule, 'enrichIndex').mockResolvedValueOnce(enrichedStoredIndex);
      jest.spyOn(importModule, 'getIndexProperties').mockReturnValueOnce(mutatedIndex);

      const log = new FileLog();
      const webhooks = new Map();
      const replicas = new Map();
      await expect(doUpdate(hub, replicas, mutatedIndex, webhooks, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(hub.related.searchIndexes.get).toHaveBeenCalledWith('stored-id');
      expect(exportModule.enrichIndex).toHaveBeenCalledWith(expect.any(Map), replicas, storedIndex);
      expect(log.getData('UPDATE')).toEqual([]);
      expect(mockUpdate.mock.calls[0][0].toJSON()).toEqual(expectedIndex.toJSON());
    });
  });

  describe('loadAndRewriteWebhooks', () => {
    it('should create an id to webhook map from the webhooks loaded from the given directory', async () => {
      const webhooks = {
        'directory/webhooks/webhook1.json': new Webhook({
          id: 'id1',
          label: 'webhook1',
          customPayload: { value: 'a' }
        }),
        'directory/webhooks/webhook2.json': new Webhook({
          id: 'id2',
          label: 'webhook2',
          customPayload: { value: 'b' }
        })
      };

      const hub = new Hub({
        name: 'accountName',
        settings: {
          virtualStagingEnvironment: {
            hostname: 'http://amplience.com'
          }
        }
      });

      (loadJsonFromDirectory as jest.Mock).mockReturnValue(webhooks);
      jest.spyOn(webhookRewriter, 'rewriteDeliveryContentItem').mockImplementation(body => {
        return body + '-rewrite';
      });

      const result = await loadAndRewriteWebhooks(hub, 'directory/webhooks');

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('directory/webhooks', Webhook);
      expect(result.size).toEqual(2);
      expect(result.get('id1')).toEqual(webhooks['directory/webhooks/webhook1.json']);
      expect(result.get('id2')).toEqual(webhooks['directory/webhooks/webhook2.json']);
      expect(webhooks['directory/webhooks/webhook1.json'].customPayload).toEqual({ value: 'a-rewrite' });
      expect(webhooks['directory/webhooks/webhook2.json'].customPayload).toEqual({ value: 'b-rewrite' });

      expect(webhookRewriter.rewriteDeliveryContentItem).toHaveBeenNthCalledWith(
        1,
        'a',
        'accountName',
        'http://amplience.com'
      );
      expect(webhookRewriter.rewriteDeliveryContentItem).toHaveBeenNthCalledWith(
        2,
        'b',
        'accountName',
        'http://amplience.com'
      );
    });

    it('should not rewrite webhook body if none is present', async () => {
      const webhooks = {
        'directory/webhooks/webhook1.json': new Webhook({
          id: 'id1',
          label: 'webhook1'
        }),
        'directory/webhooks/webhook2.json': new Webhook({
          id: 'id2',
          label: 'webhook2'
        })
      };

      const hub = new Hub({
        name: 'accountName',
        settings: {
          virtualStagingEnvironment: {
            hostname: 'http://amplience.com'
          }
        }
      });

      (loadJsonFromDirectory as jest.Mock).mockReturnValue(webhooks);
      jest.spyOn(webhookRewriter, 'rewriteDeliveryContentItem');

      const result = await loadAndRewriteWebhooks(hub, 'directory/webhooks');

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('directory/webhooks', Webhook);
      expect(result.size).toEqual(2);
      expect(result.get('id1')).toEqual(webhooks['directory/webhooks/webhook1.json']);
      expect(result.get('id2')).toEqual(webhooks['directory/webhooks/webhook2.json']);
      expect(webhooks['directory/webhooks/webhook1.json'].customPayload).toBeUndefined();
      expect(webhooks['directory/webhooks/webhook2.json'].customPayload).toBeUndefined();

      expect(webhookRewriter.rewriteDeliveryContentItem).not.toHaveBeenCalled();
    });

    it('should pass an undefined vse to the rewriter if the object is missing from settings', async () => {
      const webhooks = {
        'directory/webhooks/webhook1.json': new Webhook({
          id: 'id1',
          label: 'webhook1',
          customPayload: { value: 'a' }
        })
      };

      const hub = new Hub({
        name: 'accountName',
        settings: {}
      });

      (loadJsonFromDirectory as jest.Mock).mockReturnValue(webhooks);
      jest.spyOn(webhookRewriter, 'rewriteDeliveryContentItem').mockImplementation(body => {
        return body + '-rewrite';
      });

      const result = await loadAndRewriteWebhooks(hub, 'directory/webhooks');

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('directory/webhooks', Webhook);
      expect(result.size).toEqual(1);
      expect(result.get('id1')).toEqual(webhooks['directory/webhooks/webhook1.json']);
      expect(webhooks['directory/webhooks/webhook1.json'].customPayload).toEqual({ value: 'a-rewrite' });

      expect(webhookRewriter.rewriteDeliveryContentItem).toHaveBeenCalledWith('a', 'accountName', undefined);
    });
  });

  describe('processIndices', () => {
    let mockTable: jest.Mock;

    beforeEach(() => {
      mockTable = table as jest.Mock;
      mockTable.mockImplementation(jest.requireActual('table').table);
    });

    it('should create and update an index', async () => {
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
      const webhooks = new Map();
      const replicas = new Map();

      await processIndices(indicesToProcess, replicas, webhooks, hub, new FileLog());

      expect(importModule.doCreate).toHaveBeenCalledWith(hub, indicesToProcess[0], webhooks, expect.any(FileLog));
      expect(importModule.doUpdate).toHaveBeenCalledWith(
        hub,
        replicas,
        indicesToProcess[1],
        webhooks,
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

    it('should create an index and update', async (): Promise<void> => {
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
        undefined,
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
        undefined,
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
