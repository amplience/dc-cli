import * as exportModule from './export';
import * as directoryUtils from '../../common/import/directory-utils';
import {
  builder,
  command,
  filterIndexesById,
  getIndexExports,
  getExportRecordForIndex,
  handler,
  LOG_FILENAME,
  processIndexes,
  EnrichedSearchIndex,
  EnrichedAssignedContentType,
  webhookEquals,
  replicaEquals,
  EnrichedReplica,
  getExportedWebhooks,
  processWebhooks,
  filterWebhooks
} from './export';
import Yargs from 'yargs/yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { SearchIndex, SearchIndexSettings, Webhook } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import * as exportServiceModule from '../../services/export.service';
import { table } from 'table';
import chalk from 'chalk';
import { loadJsonFromDirectory } from '../../services/import.service';
import { FileLog } from '../../common/file-log';
import { streamTableOptions } from '../../common/table/table.consts';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { validateNoDuplicateIndexNames } from './import';
import { SearchIndexKey } from 'dc-management-sdk-js/build/main/lib/model/SearchIndexKey';
import { AssignedContentType } from 'dc-management-sdk-js/build/main/lib/model/AssignedContentType';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('./import');
jest.mock('../../services/import.service');
jest.mock('../../common/import/directory-utils');
jest.mock('table');
jest.mock('../../common/log-helpers');

describe('search-index export command', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('should implement an export command', () => {
    expect(command).toEqual('export <dir>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Output directory for the exported Search Index definitions',
        type: 'string'
      });
      expect(spyOption).toHaveBeenCalledWith('id', {
        type: 'string',
        describe:
          'The ID of a Search Index to be exported.\nIf no --id option is given, all search indexes for the hub are exported.\nA single --id option may be given to export a single Search Index.\nMultiple --id options may be given to export multiple search indexes at the same time.',
        requiresArg: true
      });
      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'Overwrite search indexes without asking.'
      });
      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: createLog
      });
    });
  });

  describe('webhookEquals', () => {
    it('should match undefined webhooks, and return false if only one argument is undefined', async () => {
      expect(webhookEquals(undefined, undefined)).toBeTruthy();
      expect(webhookEquals(new Webhook(), undefined)).toBeFalsy();
      expect(webhookEquals(undefined, new Webhook())).toBeFalsy();
    });

    it('should compare webhooks on all parameters', async () => {
      const exampleWebhook = {
        method: 'GET',
        secret: 'bananabread',
        label: 'webhook',
        active: true,
        customPayload: { type: 'example', value: 'text' },
        events: ['event1'],
        filters: [{ type: 'equal', arguments: [{ jsonPath: 'path' }] }],
        handlers: ['handler1'],
        headers: [{ key: 'key', value: 'value' }]
      };

      expect(
        webhookEquals(new Webhook(exampleWebhook), new Webhook({ ...exampleWebhook, unrelatedProperty: true }))
      ).toBeTruthy();

      expect(
        webhookEquals(new Webhook(exampleWebhook), new Webhook({ ...exampleWebhook, method: 'POST' }))
      ).toBeFalsy();
      expect(
        webhookEquals(new Webhook(exampleWebhook), new Webhook({ ...exampleWebhook, secret: 'applepie' }))
      ).toBeFalsy();
      expect(
        webhookEquals(new Webhook(exampleWebhook), new Webhook({ ...exampleWebhook, label: 'webhook2' }))
      ).toBeFalsy();
      expect(webhookEquals(new Webhook(exampleWebhook), new Webhook({ ...exampleWebhook, active: false }))).toBeFalsy();
      expect(
        webhookEquals(
          new Webhook(exampleWebhook),
          new Webhook({ ...exampleWebhook, customPayload: { type: 'example', value: 'text2' } })
        )
      ).toBeFalsy();
      expect(
        webhookEquals(new Webhook(exampleWebhook), new Webhook({ ...exampleWebhook, events: ['event1', 'event2'] }))
      ).toBeFalsy();
      expect(
        webhookEquals(
          new Webhook(exampleWebhook),
          new Webhook({ ...exampleWebhook, filters: [{ type: 'in', arguments: [{ jsonPath: 'path' }] }] })
        )
      ).toBeFalsy();
      expect(webhookEquals(new Webhook(exampleWebhook), new Webhook({ ...exampleWebhook, handlers: [] }))).toBeFalsy();
      expect(
        webhookEquals(
          new Webhook(exampleWebhook),
          new Webhook({ ...exampleWebhook, headers: [{ key: 'key', value: 'value' }, { key: 'key', value: 'value2' }] })
        )
      ).toBeFalsy();
    });
  });

  describe('replicaEquals', () => {
    it('should compare replicas on all settings and label', async () => {
      const exampleReplica = {
        label: 'replicaIndex',
        settings: { example: 'object', example2: 'a' }
      };

      expect(
        replicaEquals(
          new EnrichedReplica(exampleReplica),
          new EnrichedReplica({ ...exampleReplica, unrelatedProperty: true }),
          false
        )
      ).toBeTruthy();

      expect(
        replicaEquals(
          new EnrichedReplica(exampleReplica),
          new EnrichedReplica({ ...exampleReplica, label: 'different' }),
          false
        )
      ).toBeFalsy();
      expect(
        replicaEquals(
          new EnrichedReplica(exampleReplica),
          new EnrichedReplica({ ...exampleReplica, settings: { example: 'object', example2: 'b' } }),
          false
        )
      ).toBeFalsy();
    });

    it('should only compare keys when keys argument is true', async () => {
      const exampleReplica = {
        label: 'replicaIndex',
        keys: { key: 'expected' },
        settings: { example: 'object', example2: 'a' }
      };

      expect(
        replicaEquals(
          new EnrichedReplica(exampleReplica),
          new EnrichedReplica({ ...exampleReplica, keys: { key: 'unexpected' } }),
          false
        )
      ).toBeTruthy();

      expect(
        replicaEquals(
          new EnrichedReplica(exampleReplica),
          new EnrichedReplica({ ...exampleReplica, keys: { key: 'unexpected' } }),
          true
        )
      ).toBeFalsy();
    });
  });

  describe('enrichReplica tests', () => {
    it('should request settings and keys to enrich the given indexes', async (): Promise<void> => {
      const index = new SearchIndex({
        name: 'account.suffix-1',
        suffix: 'suffix-1',
        label: 'Index 1',
        type: 'STAGING'
      });

      const settings = new SearchIndexSettings({
        example: 'setting'
      });

      const key = new SearchIndexKey({
        id: 'key-id',
        key: 'example-key'
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (index as any).related = {
        settings: {
          get: jest.fn().mockResolvedValue(settings)
        },
        keys: {
          get: jest.fn().mockResolvedValue(key)
        }
      };

      const expectedEnriched = new EnrichedReplica({
        ...index.toJSON(),
        settings: settings,
        keys: key
      });

      const enriched = await exportModule.enrichReplica(index);

      expect(index.related.settings.get).toHaveBeenCalledTimes(1);
      expect(index.related.keys.get).toHaveBeenCalledTimes(1);

      expect(enriched.toJSON()).toEqual(expectedEnriched.toJSON());
    });
  });

  describe('enrichIndex tests', () => {
    let index: SearchIndex;
    let settings: SearchIndexSettings;
    let key: SearchIndexKey;
    let assignedContentTypes: AssignedContentType[];
    let enrichedContentTypes: EnrichedAssignedContentType[];

    beforeEach(() => {
      index = new SearchIndex({
        id: 'id-1',
        name: 'account.suffix-1',
        suffix: 'suffix-1',
        label: 'Index 1',
        type: 'STAGING'
      });

      settings = new SearchIndexSettings({
        example: 'setting'
      });

      key = new SearchIndexKey({
        id: 'key-id',
        key: 'example-key'
      });

      assignedContentTypes = [
        new AssignedContentType({ contentTypeUri: 'http://1' }),
        new AssignedContentType({ contentTypeUri: 'http://2' })
      ];

      enrichedContentTypes = [];

      assignedContentTypes.forEach((type, index) => {
        type.related.webhook = jest.fn().mockResolvedValue(new Webhook({ id: 'webhook-' + index }));
        type.related.activeContentWebhook = jest.fn().mockResolvedValue(new Webhook({ id: 'webhook-active-' + index }));
        type.related.archivedContentWebhook = jest
          .fn()
          .mockResolvedValue(new Webhook({ id: 'webhook-archive-' + index }));

        enrichedContentTypes[index] = new EnrichedAssignedContentType({
          contentTypeUri: type.contentTypeUri,
          webhook: 'webhook-' + index,
          activeContentWebhook: 'webhook-active-' + index,
          archivedContentWebhook: 'webhook-archive-' + index
        });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (index as any).related = {
        settings: {
          get: jest.fn().mockResolvedValue(settings)
        },
        assignedContentTypes: {
          list: jest.fn().mockResolvedValue(new MockPage(AssignedContentType, assignedContentTypes))
        },
        keys: {
          get: jest.fn().mockResolvedValue(key)
        }
      };
    });

    it('should request settings, types, keys and webhooks to enrich the given indexes', async (): Promise<void> => {
      const expectedEnriched = new EnrichedSearchIndex({
        ...index.toJSON(),
        settings: settings,
        keys: key,
        assignedContentTypes: enrichedContentTypes,
        replicas: []
      });

      const enriched = await exportModule.enrichIndex(new Map(), new Map(), index);

      expect(index.related.settings.get).toHaveBeenCalledTimes(1);
      expect(index.related.assignedContentTypes.list).toHaveBeenCalledTimes(1);
      expect(index.related.keys.get).toHaveBeenCalledTimes(1);

      for (const type of assignedContentTypes) {
        expect(type.related.webhook).toHaveBeenCalledTimes(1);
        expect(type.related.activeContentWebhook).toHaveBeenCalledTimes(1);
        expect(type.related.archivedContentWebhook).toHaveBeenCalledTimes(1);
      }

      expect(enriched.toJSON()).toEqual(expectedEnriched.toJSON());
    });

    it('should enrich replicas when present', async (): Promise<void> => {
      const allReplicas = new Map<string, SearchIndex[]>();

      const replica = new SearchIndex({ id: 'replica-1' });
      const enrichedReplica = new EnrichedReplica(replica);
      allReplicas.set('id-1', [replica]);

      jest.spyOn(exportModule, 'enrichReplica').mockResolvedValue(enrichedReplica);

      const expectedEnriched = new EnrichedSearchIndex({
        ...index.toJSON(),
        settings: settings,
        keys: key,
        assignedContentTypes: enrichedContentTypes,
        replicas: [enrichedReplica]
      });

      const enriched = await exportModule.enrichIndex(new Map(), allReplicas, index);

      expect(exportModule.enrichReplica).toHaveBeenCalledWith(replica, 0, [replica]);

      expect(index.related.settings.get).toHaveBeenCalledTimes(1);
      expect(index.related.assignedContentTypes.list).toHaveBeenCalledTimes(1);
      expect(index.related.keys.get).toHaveBeenCalledTimes(1);

      for (const type of assignedContentTypes) {
        expect(type.related.webhook).toHaveBeenCalledTimes(1);
        expect(type.related.activeContentWebhook).toHaveBeenCalledTimes(1);
        expect(type.related.archivedContentWebhook).toHaveBeenCalledTimes(1);
      }

      expect(enriched.toJSON()).toEqual(expectedEnriched.toJSON());
    });
  });

  describe('getExportedWebhooks', () => {
    it('should create an id to webhook map from the webhooks loaded from the given directory', () => {
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

      (loadJsonFromDirectory as jest.Mock).mockReturnValue(webhooks);

      const result = getExportedWebhooks('directory');

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('directory/webhooks', Webhook);
      expect(result.size).toEqual(2);
      expect(result.get('id1')).toEqual(webhooks['directory/webhooks/webhook1.json']);
      expect(result.get('id2')).toEqual(webhooks['directory/webhooks/webhook2.json']);
    });

    it('should ignore webhooks without an id', () => {
      const webhooks = {
        'directory/webhooks/webhook1.json': new Webhook({
          id: 'id1',
          label: 'webhook1'
        }),
        'directory/webhooks/webhook2.json': new Webhook({
          label: 'webhook2'
        })
      };

      (loadJsonFromDirectory as jest.Mock).mockReturnValue(webhooks);

      const result = getExportedWebhooks('directory');

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('directory/webhooks', Webhook);
      expect(result.size).toEqual(1);
      expect(result.get('id1')).toEqual(webhooks['directory/webhooks/webhook1.json']);
    });
  });

  describe('getIndexExports', () => {
    let getExportRecordForIndexSpy: jest.SpyInstance;

    const indexesToExport = [
      new EnrichedSearchIndex({
        name: 'index-name-1',
        label: 'index 1',
        assignedContentTypes: [
          new AssignedContentType({
            id: 'assigned-type-1'
          })
        ]
      }),
      new EnrichedSearchIndex({
        name: 'index-name-2',
        label: 'index 2',
        assignedContentTypes: [
          new AssignedContentType({
            id: 'assigned-type-2'
          })
        ]
      })
    ];

    const exportedIndexes = {
      'export-dir/export-filename-1.json': indexesToExport[0],
      'export-dir/export-filename-2.json': indexesToExport[1]
    };

    beforeEach(() => {
      getExportRecordForIndexSpy = jest.spyOn(exportModule, 'getExportRecordForIndex');
    });

    it('should return a list of indexes to export and no filenames that will be updated (first export)', () => {
      const exportedWebhooks = new Map();
      jest.spyOn(exportModule, 'getExportedWebhooks').mockReturnValueOnce(exportedWebhooks);

      getExportRecordForIndexSpy
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-1.json',
          status: 'CREATED',
          index: indexesToExport[0]
        })
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-2.json',
          status: 'CREATED',
          index: indexesToExport[1]
        });

      const [allExports, updatedExportsMap] = getIndexExports('export-dir', {}, indexesToExport, new Map());

      expect(getExportRecordForIndexSpy).toHaveBeenCalledTimes(2);
      expect(getExportRecordForIndexSpy.mock.calls).toMatchSnapshot();
      expect(allExports).toMatchSnapshot();
      expect(updatedExportsMap).toEqual([]);
    });

    it('should return a list of indexes to export and a list of filenames that will be updated', () => {
      const exportedWebhooks = new Map();
      jest.spyOn(exportModule, 'getExportedWebhooks').mockReturnValueOnce(exportedWebhooks);

      getExportRecordForIndexSpy
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-1.json',
          status: 'CREATED',
          index: indexesToExport[0]
        })
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-2.json',
          status: 'UPDATED',
          index: indexesToExport[1]
        });

      const [allExports, updatedExportsMap] = getIndexExports(
        'export-dir',
        exportedIndexes,
        indexesToExport,
        new Map()
      );

      expect(getExportRecordForIndexSpy).toHaveBeenCalledTimes(2);
      expect(getExportRecordForIndexSpy.mock.calls).toMatchSnapshot();
      expect(allExports).toMatchSnapshot();
      expect(updatedExportsMap).toMatchSnapshot();
    });

    it('should not return a list of indexes to export or a list of filenames that will be updated', () => {
      const exportedWebhooks = new Map();
      jest.spyOn(exportModule, 'getExportedWebhooks').mockReturnValueOnce(exportedWebhooks);
      const [allExports, updatedExportsMap] = getIndexExports('export-dir', {}, [], new Map());

      expect(getExportRecordForIndexSpy).toHaveBeenCalledTimes(0);
      expect(allExports).toEqual([]);
      expect(updatedExportsMap).toEqual([]);
    });

    it('should skip any that are missing a name', () => {
      const exportedWebhooks = new Map();
      jest.spyOn(exportModule, 'getExportedWebhooks').mockReturnValueOnce(exportedWebhooks);

      const [allExports, updatedExportsMap] = getIndexExports(
        'export-dir',
        {},
        [
          new EnrichedSearchIndex({
            label: 'index 1'
          })
        ],
        new Map()
      );

      expect(getExportRecordForIndexSpy).toHaveBeenCalledTimes(0);
      expect(allExports).toEqual([]);
      expect(updatedExportsMap).toEqual([]);
    });
  });

  describe('getExportRecordForIndex', () => {
    const extraResources = {
      settings: new SearchIndexSettings({
        setting: 'test'
      }),
      keys: new SearchIndexKey({
        key: 'test'
      }),
      assignedContentTypes: [
        new AssignedContentType({
          id: 'assigned-type-1'
        })
      ],
      replicas: []
    };

    it('should create export for any newly exported index', async () => {
      const exportedIndexes = {
        'export-dir/export-filename-1.json': new EnrichedSearchIndex({
          name: 'index-name-1',
          label: 'index 1',
          ...extraResources
        }),
        'export-dir/export-filename-2.json': new EnrichedSearchIndex({
          name: 'index-name-2',
          label: 'index 2',
          ...extraResources
        })
      };
      const newIndexToExport = new EnrichedSearchIndex({
        name: 'index-name-3',
        label: 'index 3',
        ...extraResources
      });

      jest.spyOn(exportServiceModule, 'uniqueFilenamePath').mockReturnValueOnce('export-dir/export-filename-3.json');

      const existingIndexes = Object.keys(exportedIndexes);

      const result = getExportRecordForIndex(newIndexToExport, 'export-dir', exportedIndexes, new Map(), new Map());

      expect(exportServiceModule.uniqueFilenamePath).toHaveBeenCalledWith(
        'export-dir',
        newIndexToExport.name,
        'json',
        existingIndexes
      );
      expect(result).toEqual({
        filename: 'export-dir/export-filename-3.json',
        status: 'CREATED',
        index: newIndexToExport
      });
    });

    it('should update export for any index with different content', async () => {
      const exportedIndexes = {
        'export-dir/export-filename-1.json': new EnrichedSearchIndex({
          name: 'index-name-1',
          label: 'index 1',
          ...extraResources
        }),
        'export-dir/export-filename-2.json': new EnrichedSearchIndex({
          name: 'index-name-2',
          label: 'index 2',
          ...extraResources
        })
      };
      const updatedIndexToExport = new EnrichedSearchIndex({
        id: 'index-id-2',
        name: 'index-name-2',
        label: 'index 2 - mutated label',
        ...extraResources
      });

      jest.spyOn(exportServiceModule, 'uniqueFilenamePath');

      const result = getExportRecordForIndex(updatedIndexToExport, 'export-dir', exportedIndexes, new Map(), new Map());

      expect(exportServiceModule.uniqueFilenamePath).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        filename: 'export-dir/export-filename-2.json',
        status: 'UPDATED',
        index: updatedIndexToExport
      });
    });

    it('should not update export for any index with same content', async () => {
      const exportedIndexes = {
        'export-dir/export-filename-1.json': new EnrichedSearchIndex({
          name: 'index-name-1',
          label: 'index 1',
          ...extraResources
        }),
        'export-dir/export-filename-2.json': new EnrichedSearchIndex({
          name: 'index-name-2',
          label: 'index 2',
          ...extraResources
        })
      };
      const unchangedIndexToExport = new EnrichedSearchIndex({
        id: 'index-id-2',
        name: 'index-name-2',
        label: 'index 2',
        ...extraResources
      });

      jest.spyOn(exportServiceModule, 'uniqueFilenamePath');

      const result = getExportRecordForIndex(
        unchangedIndexToExport,
        'export-dir',
        exportedIndexes,
        new Map(),
        new Map()
      );

      expect(exportServiceModule.uniqueFilenamePath).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        filename: 'export-dir/export-filename-2.json',
        status: 'UP-TO-DATE',
        index: unchangedIndexToExport
      });
    });
  });

  describe('filterIndexesById', () => {
    const listToFilter = [
      new EnrichedSearchIndex({
        id: 'index-id-1',
        label: 'index 1'
      }),
      new EnrichedSearchIndex({
        id: 'index-id-2',
        label: 'index 2'
      }),
      new EnrichedSearchIndex({
        id: 'index-id-3',
        label: 'index 3'
      })
    ];

    it('should return the indexes matching the given uris', async () => {
      const result = filterIndexesById(listToFilter, ['index-id-1', 'index-id-3']);
      expect(result).toEqual(expect.arrayContaining([listToFilter[0], listToFilter[2]]));
    });

    it('should return all the indexes because there are no URIs to filter', async () => {
      const result = filterIndexesById(listToFilter, []);
      expect(result).toEqual(listToFilter);
    });

    it('should throw an error for ids which do not exist in the list of indexes', async () => {
      expect(() =>
        filterIndexesById(listToFilter, ['index-id-1', 'index-id-4', 'index-id-3'])
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('processIndexes', () => {
    let mockEnsureDirectory: jest.Mock;
    let mockTable: jest.Mock;
    let stdoutSpy: jest.SpyInstance;

    const indexesToProcess = [
      new EnrichedSearchIndex({
        id: 'index-id-1',
        name: 'index-name-1',
        label: 'index 1',
        status: 'ACTIVE'
      }),
      new EnrichedSearchIndex({
        id: 'index-id-2',
        name: 'index-name-2',
        label: 'index 2',
        status: 'ACTIVE'
      }),
      new EnrichedSearchIndex({
        id: 'index-id-3',
        name: 'index-name-3',
        label: 'index 3',
        status: 'ACTIVE'
      })
    ];

    const exportedIndexes = [
      {
        name: 'index-name-1',
        label: 'index 1',
        status: 'ACTIVE'
      },
      {
        name: 'index-name-2',
        label: 'index 2',
        status: 'ACTIVE'
      },
      {
        name: 'index-name-3',
        label: 'index 3',
        status: 'ACTIVE'
      }
    ];

    beforeEach(() => {
      mockEnsureDirectory = directoryUtils.ensureDirectoryExists as jest.Mock;
      mockTable = table as jest.Mock;
      mockTable.mockImplementation(jest.requireActual('table').table);
      jest.spyOn(exportServiceModule, 'writeJsonToFile').mockImplementation();
      stdoutSpy = jest.spyOn(process.stdout, 'write');
      stdoutSpy.mockImplementation();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should output export files for the given indexes if nothing previously exported', async () => {
      jest.spyOn(exportModule, 'getIndexExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'CREATED',
            index: indexesToProcess[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'CREATED',
            index: indexesToProcess[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'CREATED',
            index: indexesToProcess[2]
          }
        ],
        []
      ]);

      const previouslyExportedIndexes = {};
      const webhooks = new Map();
      await processIndexes('export-dir', previouslyExportedIndexes, indexesToProcess, webhooks, new FileLog(), false);

      expect(exportModule.getIndexExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getIndexExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedIndexes,
        indexesToProcess,
        webhooks
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);

      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(3);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        1,
        'export-dir/export-filename-1.json',
        expect.objectContaining(exportedIndexes[0])
      );
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        2,
        'export-dir/export-filename-2.json',
        expect.objectContaining(exportedIndexes[1])
      );
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        3,
        'export-dir/export-filename-3.json',
        expect.objectContaining(exportedIndexes[2])
      );

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('File'), chalk.bold('Name'), chalk.bold('Result')],
          ['export-dir/export-filename-1.json', indexesToProcess[0].name, 'CREATED'],
          ['export-dir/export-filename-2.json', indexesToProcess[1].name, 'CREATED'],
          ['export-dir/export-filename-3.json', indexesToProcess[2].name, 'CREATED']
        ],
        streamTableOptions
      );
    });

    it('should output a message if no indexes to export from hub', async () => {
      jest.spyOn(exportModule, 'getIndexExports').mockReturnValueOnce([[], []]);

      const previouslyExportedIndexes = {};

      await processIndexes('export-dir', previouslyExportedIndexes, [], new Map(), new FileLog(), false);

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(0);
      expect(exportModule.getIndexExports).toHaveBeenCalledTimes(0);
      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(0);
      expect(mockTable).toHaveBeenCalledTimes(0);
    });

    it('should not output any export files if a previous export exists and the index is unchanged', async () => {
      jest.spyOn(exportModule, 'getIndexExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            index: indexesToProcess[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UP-TO-DATE',
            index: indexesToProcess[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UP-TO-DATE',
            index: indexesToProcess[2]
          }
        ],
        []
      ]);

      const previouslyExportedIndexes = {
        'export-dir/export-filename-2.json': new EnrichedSearchIndex(exportedIndexes[1])
      };
      const webhooks = new Map();
      const indexes = [...indexesToProcess];
      await processIndexes('export-dir', previouslyExportedIndexes, indexes, webhooks, new FileLog(), false);

      expect(exportModule.getIndexExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getIndexExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedIndexes,
        indexes,
        webhooks
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(0);

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('File'), chalk.bold('Name'), chalk.bold('Result')],
          ['export-dir/export-filename-1.json', indexesToProcess[0].name, 'UP-TO-DATE'],
          ['export-dir/export-filename-2.json', indexesToProcess[1].name, 'UP-TO-DATE'],
          ['export-dir/export-filename-3.json', indexesToProcess[2].name, 'UP-TO-DATE']
        ],
        streamTableOptions
      );
    });

    it('should update the existing export file for a changed index', async () => {
      const mutatedIndexes = [...indexesToProcess];
      mutatedIndexes[1] = new EnrichedSearchIndex({
        id: 'index-id-2',
        name: 'index-name-2',
        label: 'index 2 - mutated label',
        status: 'ACTIVE'
      });

      jest.spyOn(exportServiceModule, 'promptToOverwriteExports').mockResolvedValueOnce(true);

      jest.spyOn(exportModule, 'getIndexExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            index: mutatedIndexes[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UPDATED',
            index: mutatedIndexes[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UP-TO-DATE',
            index: mutatedIndexes[2]
          }
        ],
        [
          {
            filename: 'export-dir/export-filename-2.json',
            uri: mutatedIndexes[1].id as string
          }
        ]
      ]);

      const previouslyExportedIndexes = {
        'export-dir/export-filename-2.json': new EnrichedSearchIndex(exportedIndexes[1])
      };
      const webhooks = new Map();

      await processIndexes('export-dir', previouslyExportedIndexes, mutatedIndexes, webhooks, new FileLog(), false);

      expect(exportModule.getIndexExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getIndexExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedIndexes,
        mutatedIndexes,
        webhooks
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(1);

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('File'), chalk.bold('Name'), chalk.bold('Result')],
          ['export-dir/export-filename-1.json', indexesToProcess[0].name, 'UP-TO-DATE'],
          ['export-dir/export-filename-2.json', indexesToProcess[1].name, 'UPDATED'],
          ['export-dir/export-filename-3.json', indexesToProcess[2].name, 'UP-TO-DATE']
        ],
        streamTableOptions
      );
    });

    it('should not update anything if the user says "n" to the overwrite prompt', async () => {
      const mutatedIndexes = [...indexesToProcess];
      mutatedIndexes[1] = new EnrichedSearchIndex({
        id: 'index-id-2',
        name: 'index-name-2',
        label: 'index 2 - mutated label',
        status: 'ACTIVE'
      });

      jest.spyOn(exportServiceModule, 'promptToOverwriteExports').mockResolvedValueOnce(false);
      jest.spyOn(exportModule, 'getIndexExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            index: mutatedIndexes[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UPDATED',
            index: mutatedIndexes[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UP-TO-DATE',
            index: mutatedIndexes[2]
          }
        ],
        [
          {
            filename: 'export-dir/export-filename-2.json',
            uri: mutatedIndexes[1].id as string
          }
        ]
      ]);

      const previouslyExportedIndexes = {
        'export-dir/export-filename-2.json': new EnrichedSearchIndex(exportedIndexes[1])
      };
      const webhooks = new Map();

      await processIndexes('export-dir', previouslyExportedIndexes, mutatedIndexes, webhooks, new FileLog(), false);

      expect(exportModule.getIndexExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getIndexExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedIndexes,
        mutatedIndexes,
        webhooks
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(0);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(0);
      expect(mockTable).toHaveBeenCalledTimes(0);
    });
  });

  describe('filterWebhooks', () => {
    it('should return a webhook mapping consisting of only webhooks in the given search indexes', () => {
      const webhooks = new Map([
        ['id1', new Webhook({ id: 'id1', label: 'webhook1' })],
        ['id2', new Webhook({ id: 'id2', label: 'webhook2' })],
        ['id3', new Webhook({ id: 'id3', label: 'webhook3' })],
        ['id4', new Webhook({ id: 'id4', label: 'webhook4' })]
      ]);

      const indexes = [
        new EnrichedSearchIndex({
          assignedContentTypes: [
            new EnrichedAssignedContentType({
              webhook: 'id1',
              activeContentWebhook: 'id2',
              archivedContentWebhook: 'id4'
            })
          ]
        }),
        new EnrichedSearchIndex({
          assignedContentTypes: [
            new EnrichedAssignedContentType({
              webhook: 'id4',
              activeContentWebhook: 'id1',
              archivedContentWebhook: 'id2'
            })
          ]
        })
      ];

      const result = filterWebhooks(webhooks, indexes);

      expect(result.size).toEqual(3);
      expect(result.get('id1')).toEqual(webhooks.get('id1'));
      expect(result.get('id2')).toEqual(webhooks.get('id2'));
      expect(result.get('id4')).toEqual(webhooks.get('id4'));
    });

    it('should filter all webhooks if no indexes are provided', () => {
      const webhooks = new Map([
        ['id1', new Webhook({ id: 'id1', label: 'webhook1' })],
        ['id2', new Webhook({ id: 'id2', label: 'webhook2' })],
        ['id3', new Webhook({ id: 'id3', label: 'webhook3' })],
        ['id4', new Webhook({ id: 'id4', label: 'webhook4' })]
      ]);

      const indexes: EnrichedSearchIndex[] = [];
      const result = filterWebhooks(webhooks, indexes);

      expect(result.size).toEqual(0);
    });
  });

  describe('processWebhooks', () => {
    let mockEnsureDirectory: jest.Mock;
    let mockTable: jest.Mock;
    let stdoutSpy: jest.SpyInstance;

    beforeEach(() => {
      mockEnsureDirectory = directoryUtils.ensureDirectoryExists as jest.Mock;
      mockTable = table as jest.Mock;
      mockTable.mockImplementation(jest.requireActual('table').table);
      jest.spyOn(exportServiceModule, 'writeJsonToFile').mockImplementation();
      stdoutSpy = jest.spyOn(process.stdout, 'write');
      stdoutSpy.mockImplementation();
    });

    it('should export webhooks, printing a table of all exported files', async () => {
      const webhooks = [
        new Webhook({
          id: 'id1',
          label: 'webhook1'
        }),
        new Webhook({
          id: 'id2',
          label: 'webhook2'
        }),
        new Webhook({
          id: 'id3',
          label: 'webhook2'
        })
      ];

      await processWebhooks('export-dir', webhooks, new FileLog());

      expect(mockEnsureDirectory).toHaveBeenCalledWith('export-dir/webhooks');

      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(3);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        1,
        'export-dir/webhooks/webhook1.json',
        webhooks[0]
      );
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        2,
        'export-dir/webhooks/webhook2.json',
        webhooks[1]
      );
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        3,
        'export-dir/webhooks/webhook2-1.json',
        webhooks[2]
      );

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('File'), chalk.bold('Label'), chalk.bold('Result')],
          ['export-dir/webhooks/webhook1.json', webhooks[0].label, 'UPDATED'],
          ['export-dir/webhooks/webhook2.json', webhooks[1].label, 'UPDATED'],
          ['export-dir/webhooks/webhook2-1.json', webhooks[2].label, 'UPDATED']
        ],
        streamTableOptions
      );
    });
  });

  describe('separateReplicas', () => {
    it('it should separate replicas into a mapping', () => {
      const indexes = [
        new SearchIndex({
          id: 'parent',
          label: 'not-replica',
          parentId: null
        }),
        new SearchIndex({
          id: 'child',
          label: 'replica',
          parentId: 'parent'
        }),
        new SearchIndex({
          id: 'child2',
          label: 'replica2',
          parentId: 'parent'
        }),
        new SearchIndex({
          id: 'not-parent',
          label: 'not-replica2',
          parentId: null
        })
      ];

      const { storedIndexes, allReplicas } = exportModule.separateReplicas(indexes);

      expect(storedIndexes).toEqual([indexes[0], indexes[3]]);
      expect(allReplicas.size).toEqual(1);
      expect(allReplicas.get('parent')).toEqual([indexes[1], indexes[2]]);
    });

    it('it should return no replicas when none are present', () => {
      const indexes = [
        new SearchIndex({
          id: 'parent',
          label: 'not-replica',
          parentId: null
        }),
        new SearchIndex({
          id: 'not-parent',
          label: 'not-replica2',
          parentId: null
        })
      ];

      const { storedIndexes, allReplicas } = exportModule.separateReplicas(indexes);

      expect(storedIndexes).toEqual(indexes);
      expect(allReplicas.size).toEqual(0);
    });

    it('it should return nothing when no indexes are provided', () => {
      const { storedIndexes, allReplicas } = exportModule.separateReplicas([]);

      expect(storedIndexes).toEqual([]);
      expect(allReplicas.size).toEqual(0);
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

    const indexesToExport: EnrichedSearchIndex[] = [
      new EnrichedSearchIndex({
        name: 'account.suffix-1',
        suffix: 'suffix-1',
        label: 'Index 1',
        type: 'STAGING',
        settings: {},
        keys: {},
        assignedContentTypes: [],
        replicas: []
      }),
      new EnrichedSearchIndex({
        name: 'account.suffix-2',
        suffix: 'suffix-2',
        label: 'Index 2',
        type: 'STAGING',
        settings: {},
        keys: {},
        assignedContentTypes: [],
        replicas: []
      })
    ];

    let mockGetHub: jest.Mock;
    let mockList: jest.Mock;

    beforeEach(() => {
      jest.resetAllMocks();
      (loadJsonFromDirectory as jest.Mock).mockReturnValue([]);

      const listResponse = new MockPage(SearchIndex, indexesToExport);
      mockList = jest.fn().mockResolvedValue(listResponse);

      mockGetHub = jest.fn().mockResolvedValue({
        _links: { 'algolia-search-indexes': {} },
        related: {
          searchIndexes: {
            list: mockList
          }
        }
      });

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });
      jest.spyOn(exportModule, 'processIndexes').mockResolvedValue();
    });

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function() {
      LOG_FILENAME();

      expect(getDefaultLogPath).toHaveBeenCalledWith('search-index', 'export', process.platform);
    });

    it('should export all indexes for the current hub if no ids specified', async (): Promise<void> => {
      const schemaIdsToExport: string[] | undefined = undefined;
      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: schemaIdsToExport, logFile: new FileLog() };

      const filteredIndexesToExport = [...indexesToExport];
      jest
        .spyOn(exportModule, 'enrichIndex')
        .mockImplementation((x, y, z) => Promise.resolve(z as EnrichedSearchIndex));
      jest.spyOn(exportModule, 'filterIndexesById').mockReturnValue(filteredIndexesToExport);

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalledTimes(1);
      expect(mockList).toHaveBeenCalledWith(undefined, undefined, { size: 100 });
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, EnrichedSearchIndex);
      expect(validateNoDuplicateIndexNames).toHaveBeenCalled();
      expect(exportModule.filterIndexesById).toHaveBeenCalledWith(indexesToExport, []);
      expect(exportModule.processIndexes).toHaveBeenCalledWith(
        argv.dir,
        [],
        filteredIndexesToExport,
        expect.any(Map),
        expect.any(FileLog),
        false
      );
    });

    it('should export only selected indexes if ids specified', async (): Promise<void> => {
      const idsToExport: string[] | undefined = ['index-id-2'];
      const argv = { ...yargArgs, ...config, dir: 'my-dir', id: idsToExport, logFile: new FileLog() };

      const filteredIndexesToExport = [indexesToExport[1]];
      jest
        .spyOn(exportModule, 'enrichIndex')
        .mockImplementation((x, y, z) => Promise.resolve(z as EnrichedSearchIndex));
      jest.spyOn(exportModule, 'filterIndexesById').mockReturnValue(filteredIndexesToExport);

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalled();
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, EnrichedSearchIndex);
      expect(validateNoDuplicateIndexNames).toHaveBeenCalled();
      expect(exportModule.filterIndexesById).toHaveBeenCalledWith(indexesToExport, idsToExport);
      expect(exportModule.processIndexes).toHaveBeenCalledWith(
        argv.dir,
        [],
        filteredIndexesToExport,
        expect.any(Map),
        expect.any(FileLog),
        false
      );
    });

    it('should exit early if algolia-search-indexes link is missing', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', logFile: new FileLog() };

      jest.spyOn(exportModule, 'enrichIndex');
      jest.spyOn(exportModule, 'filterIndexesById');

      const listMock = jest.fn();

      mockGetHub.mockReturnValue({
        related: {
          searchIndexes: {
            list: listMock
          }
        }
      });

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(listMock).not.toHaveBeenCalled();
      expect(loadJsonFromDirectory).not.toHaveBeenCalledWith();
      expect(validateNoDuplicateIndexNames).not.toHaveBeenCalled();
      expect(exportModule.filterIndexesById).not.toHaveBeenCalled();
      expect(exportModule.processIndexes).not.toHaveBeenCalled();
    });
  });
});
