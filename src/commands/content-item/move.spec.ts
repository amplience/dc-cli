// Copy tests are rather simple since they most of the work is done by import/export.
// Unique features are revert, throwing when parameters are wrong/missing,
// and forwarding input parameters to both import and export.

import { builder, command, handler, LOG_FILENAME } from './move';
import Yargs from 'yargs/yargs';
import * as copier from './copy';
import * as reverter from './import-revert';

import { writeFile } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';

import rmdir from 'rimraf';
import { Arguments } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { CopyItemBuilderOptions } from '../../interfaces/copy-item-builder-options.interface';
import { ItemTemplate, MockContent } from '../../common/dc-management-sdk-js/mock-content';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { getDefaultLogPath, createLog as createFileLog, createLog, openRevertLog } from '../../common/log-helpers';
import { ImportItemBuilderOptions } from '../../interfaces/import-item-builder-options.interface';
import { FileLog } from '../../common/file-log';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('./copy');
jest.mock('./import-revert');
jest.mock('../../common/log-helpers', () => ({
  ...jest.requireActual('../../common/log-helpers'),
  getDefaultLogPath: jest.fn()
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const copierAny = copier as any;

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('content-item move command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function() {
    expect(command).toEqual('move');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyOption).toHaveBeenCalledWith('revertLog', {
        type: 'string',
        describe:
          'Path to a log file to revert a move for. This will archive the most recently moved resources from the destination, unarchive from the source, and revert updated ones.',
        coerce: openRevertLog
      });

      expect(spyOption).toHaveBeenCalledWith('srcRepo', {
        type: 'string',
        describe:
          'Copy content from within a given repository. Directory structure will start at the specified repository. Will automatically export all contained folders.'
      });

      expect(spyOption).toHaveBeenCalledWith('srcFolder', {
        type: 'string',
        describe:
          'Copy content from within a given folder. Directory structure will start at the specified folder. Can be used in addition to repoId.'
      });

      expect(spyOption).toHaveBeenCalledWith('dstRepo', {
        type: 'string',
        describe:
          'Copy matching the given repository to the source base directory, by ID. Folder structure will be followed and replicated from there.'
      });

      expect(spyOption).toHaveBeenCalledWith('dstFolder', {
        type: 'string',
        describe:
          'Copy matching the given folder to the source base directory, by ID. Folder structure will be followed and replicated from there.'
      });

      expect(spyOption).toHaveBeenCalledWith('dstHubId', {
        type: 'string',
        describe: 'Destination hub ID. If not specified, it will be the same as the source.'
      });

      expect(spyOption).toHaveBeenCalledWith('dstClientId', {
        type: 'string',
        describe: "Destination account's client ID. If not specified, it will be the same as the source."
      });

      expect(spyOption).toHaveBeenCalledWith('dstSecret', {
        type: 'string',
        describe: "Destination account's secret. Must be used alongside dstClientId."
      });

      expect(spyOption).toHaveBeenCalledWith('facet', {
        type: 'string',
        describe:
          "Move content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
      });

      expect(spyOption).toHaveBeenCalledWith('mapFile', {
        type: 'string',
        describe:
          'Mapping file to use when updating content that already exists. Updated with any new mappings that are generated. If not present, will be created.'
      });

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe:
          'Overwrite content, create and assign content types, and ignore content with missing types/references without asking.'
      });

      expect(spyOption).toHaveBeenCalledWith('v', {
        type: 'boolean',
        boolean: true,
        describe: 'Only recreate folder structure - content is validated but not imported.'
      });

      expect(spyOption).toHaveBeenCalledWith('skipIncomplete', {
        type: 'boolean',
        boolean: true,
        describe: 'Skip any content item that has one or more missing dependancy.'
      });

      expect(spyOption).toHaveBeenCalledWith('excludeKeys', {
        type: 'boolean',
        boolean: true,
        describe: 'Exclude delivery keys when importing content items.'
      });

      expect(spyOption).toHaveBeenCalledWith('media', {
        type: 'boolean',
        boolean: true,
        describe:
          "Detect and rewrite media links to match assets in the target account's DAM. Your client must have DAM permissions configured."
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: createLog
      });

      expect(spyOption).toHaveBeenCalledWith('name', {
        type: 'string',
        hidden: true
      });

      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        hidden: true
      });
    });
  });

  describe('handler tests', function() {
    const yargArgs = {
      $0: 'test',
      _: ['test'],
      json: true
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id',

      logFile: new FileLog(),
      revertLog: Promise.resolve(undefined)
    };

    beforeAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/move/`);
    });

    const clearArray = (array: object[]): void => {
      array.splice(0, array.length);
    };

    beforeEach(() => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;
      clearArray(copyCalls);
    });

    async function createLog(logFileName: string, log: string): Promise<void> {
      const dir = dirname(logFileName);
      await ensureDirectoryExists(dir);
      await promisify(writeFile)(logFileName, log);
    }

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function() {
      LOG_FILENAME();

      expect(getDefaultLogPath).toHaveBeenCalledWith('item', 'move', process.platform);
    });

    it('should call copy with the correct parameters, and archive content reported as "exported"', async () => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;

      copierAny.setForceFail(false);
      const exportIds = ['example-id', 'example-id2'];
      copierAny.setOutputIds(exportIds);

      const templates: ItemTemplate[] = [
        { id: 'example-id', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { id: 'example-id2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' }
      ];

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('repo');
      mockContent.registerContentType('http://type', 'type', 'repo');
      mockContent.importItemTemplates(templates);

      const argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        srcRepo: 'repo1-id',

        dstRepo: 'repo2-id',

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',

        facet: 'name:/./,schema/./',

        mapFile: 'map.json',
        force: false,
        validate: false,
        skipIncomplete: false,
        media: true
      };
      await handler(argv);

      expect(copyCalls.length).toEqual(1);

      expect(copyCalls[0].clientId).toEqual(config.clientId);
      expect(copyCalls[0].clientSecret).toEqual(config.clientSecret);
      expect(copyCalls[0].hubId).toEqual(config.hubId);
      expect(copyCalls[0].schemaId).toEqual(argv.schemaId);
      expect(copyCalls[0].name).toEqual(argv.name);
      expect(copyCalls[0].srcRepo).toEqual(argv.srcRepo);
      expect(copyCalls[0].dstRepo).toEqual(argv.dstRepo);
      expect(copyCalls[0].dstHubId).toEqual(argv.dstHubId);
      expect(copyCalls[0].dstSecret).toEqual(argv.dstSecret);

      expect(copyCalls[0].force).toEqual(argv.force);
      expect(copyCalls[0].validate).toEqual(argv.validate);
      expect(copyCalls[0].skipIncomplete).toEqual(argv.skipIncomplete);
      expect(copyCalls[0].media).toEqual(argv.media);

      expect(argv.exportedIds).toEqual(exportIds);

      expect(mockContent.metrics.itemsArchived).toEqual(2);
    });

    it('should attempt to unarchive based on MOVE actions when passing a revert log', async () => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const revertCalls: Arguments<ImportItemBuilderOptions & ConfigurationParameters>[] = (reverter as any).calls;

      copyCalls.splice(0, copyCalls.length);
      revertCalls.splice(0, revertCalls.length);

      await createLog(
        `temp_${process.env.JEST_WORKER_ID}/move/moveRevert.txt`,
        'MOVED id1\nMOVED id2\nMOVED id3\nMOVED id4'
      );

      // Create content to revert

      const templates: ItemTemplate[] = [
        { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type', status: 'ARCHIVED' },
        {
          id: 'id2',
          label: 'item2',
          repoId: 'repo',
          typeSchemaUri: 'http://type',
          folderPath: 'folderTest',
          status: 'ARCHIVED'
        },
        {
          id: 'id3',
          label: 'item3',
          repoId: 'repo',
          typeSchemaUri: 'http://type',
          folderPath: 'folderTest/nested',
          status: 'ARCHIVED'
        },

        // This item is already unarchived, so it will be skipped.
        { id: 'id4', label: 'item4', repoId: 'repo', typeSchemaUri: 'http://type' },
        // This item shouldn't be unarchived, since it is not in the log.
        { id: 'id5', label: 'item5', repoId: 'repo', typeSchemaUri: 'http://type', status: 'ARCHIVED' }
      ];

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('repo');
      mockContent.registerContentType('http://type', 'type', 'repo');
      mockContent.importItemTemplates(templates);

      const argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',

        revertLog: openRevertLog(`temp_${process.env.JEST_WORKER_ID}/move/moveRevert.txt`)
      };
      await handler(argv);

      expect(mockContent.metrics.itemsUnarchived).toEqual(3);
      expect(copyCalls.length).toEqual(0);

      expect(revertCalls.length).toEqual(1);
      expect(revertCalls[0]).toEqual({
        $0: '',
        _: [],
        json: true,
        clientId: 'acc2-id',
        clientSecret: 'acc2-secret',
        dir: '',
        hubId: 'hub2-id',
        revertLog: expect.any(Promise),
        logFile: expect.any(FileLog)
      });

      rimraf(`temp_${process.env.JEST_WORKER_ID}/move/moveRevert.txt`);
    });

    it('should revert uninterrupted when fetching an item fails', async () => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;

      // NOTE: id3 doesn't exist, but that's OK
      await createLog(`temp_${process.env.JEST_WORKER_ID}/move/moveRevertFetch.txt`, 'MOVED id1\nMOVED id2\nMOVED id3');

      // Create content to revert
      const templates: ItemTemplate[] = [
        { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type', status: 'ARCHIVED' },
        {
          id: 'id2',
          label: 'item2',
          repoId: 'repo',
          typeSchemaUri: 'http://type',
          folderPath: 'folderTest',
          status: 'ARCHIVED'
        }
      ];

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.failItemActions = 'all';
      mockContent.createMockRepository('repo');
      mockContent.registerContentType('http://type', 'type', 'repo');
      mockContent.importItemTemplates(templates);

      const argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',

        revertLog: openRevertLog(`temp_${process.env.JEST_WORKER_ID}/move/moveRevertFetch.txt`)
      };
      await handler(argv);

      expect(mockContent.metrics.itemsUnarchived).toEqual(0);
      expect(copyCalls.length).toEqual(0);

      rimraf(`temp_${process.env.JEST_WORKER_ID}/move/moveRevertFetch.txt`);
    });

    // should revert uninterrupted when unarchiving an item fails

    it('should abort early when passing a missing revert log', async () => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;

      // Create content, shouldn't be reverted.
      const templates: ItemTemplate[] = [
        { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type', status: 'ARCHIVED' }
      ];

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('repo');
      mockContent.registerContentType('http://type', 'type', 'repo');
      mockContent.importItemTemplates(templates);

      const argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',

        revertLog: openRevertLog(`temp_${process.env.JEST_WORKER_ID}/move/moveRevertMissing.txt`)
      };
      await handler(argv);

      expect(mockContent.metrics.itemsUnarchived).toEqual(0);
      expect(copyCalls.length).toEqual(0);
    });

    it('should abort early when copy fails', async () => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;

      // These should not be archived
      const exportIds = ['example-id', 'example-id2'];
      copierAny.setOutputIds(exportIds);
      copierAny.setForceFail(true);

      // Create content, shouldn't be reverted.
      const templates: ItemTemplate[] = [
        { id: 'example-id', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { id: 'example-id2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type' }
      ];

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('repo');
      mockContent.registerContentType('http://type', 'type', 'repo');
      mockContent.importItemTemplates(templates);

      const argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret'
      };
      await handler(argv);

      expect(mockContent.metrics.itemsArchived).toEqual(0);
      expect(copyCalls.length).toEqual(1);
    });

    it('should continue if archiving moved content fails, and record the failures in the log', async () => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;

      copierAny.setForceFail(false);
      const exportIds = ['example-id', 'example-id2'];
      copierAny.setOutputIds(exportIds);

      const templates: ItemTemplate[] = [
        { id: 'example-id', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { id: 'example-id2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' }
      ];

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.failItemActions = 'all';
      mockContent.createMockRepository('repo');
      mockContent.registerContentType('http://type', 'type', 'repo');
      mockContent.importItemTemplates(templates);

      // TODO: mock handlers for export and import
      const argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        srcRepo: 'repo1-id',

        dstRepo: 'repo2-id',

        hubId: 'hub2-id',
        clientId: 'acc2-id',
        clientSecret: 'acc2-secret',

        facet: 'name:/./,schema/./',

        mapFile: 'map.json',
        force: false,
        validate: false,
        skipIncomplete: false,

        logFile: createFileLog(`temp_${process.env.JEST_WORKER_ID}/move/failLog.txt`)
      };
      await handler(argv);

      expect(copyCalls.length).toEqual(1);

      expect(argv.exportedIds).toEqual(exportIds);

      expect(mockContent.metrics.itemsArchived).toEqual(0);
    });
  });
});
