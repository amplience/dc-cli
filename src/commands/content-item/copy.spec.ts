// Copy tests are rather simple since they most of the work is done by import/export.
// Unique features are revert, throwing when parameters are wrong/missing,
// and forwarding input parameters to both import and export.

import { builder, command, handler, LOG_FILENAME } from './copy';
import Yargs from 'yargs/yargs';
import * as exporter from './export';
import * as importer from './import';
import * as reverter from './import-revert';

import rmdir from 'rimraf';
import { Arguments } from 'yargs';
import { ExportItemBuilderOptions } from '../../interfaces/export-item-builder-options.interface';
import { ConfigurationParameters } from '../configure';
import { ImportItemBuilderOptions } from '../../interfaces/import-item-builder-options.interface';
import { getDefaultLogPath } from '../../common/log-helpers';
import * as copyConfig from '../../common/content-item/copy-config';
import { FileLog } from '../../common/file-log';

jest.mock('../../services/dynamic-content-client-factory');

jest.mock('./export');
jest.mock('./import');
jest.mock('./import-revert');
jest.mock('../../common/log-helpers');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('content-item copy command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function() {
    expect(command).toEqual('copy');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyOption).toHaveBeenCalledWith('revertLog', {
        type: 'string',
        describe:
          'Path to a log file to revert a copy for. This will archive the most recently copied resources, and revert updated ones.'
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

      expect(spyOption).toHaveBeenCalledWith('copyConfig', {
        type: 'string',
        describe:
          'Path to a JSON configuration file for source/destination account. If the given file does not exist, it will be generated from the arguments.'
      });

      expect(spyOption).toHaveBeenCalledWith('lastPublish', {
        type: 'boolean',
        boolean: true,
        describe: 'When available, export the last published version of a content item rather than its newest version.'
      });

      expect(spyOption).toHaveBeenCalledWith('publish', {
        type: 'boolean',
        boolean: true,
        describe: 'Publish any content items that have an existing publish status in their JSON.'
      });

      expect(spyOption).toHaveBeenCalledWith('republish', {
        type: 'boolean',
        boolean: true,
        describe:
          'Republish content items regardless of whether the import changed them or not. (--publish not required)'
      });

      expect(spyOption).toHaveBeenCalledWith('excludeKeys', {
        type: 'boolean',
        boolean: true,
        describe: 'Exclude delivery keys when importing content items.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.'
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
      hubId: 'hub-id'
    };

    beforeAll(async () => {
      await rimraf('temp/copy/');
    });

    const clearArray = (array: object[]): void => {
      array.splice(0, array.length);
    };

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exportCalls: Arguments<ExportItemBuilderOptions & ConfigurationParameters>[] = (exporter as any).calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importCalls: Arguments<ImportItemBuilderOptions & ConfigurationParameters>[] = (importer as any).calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const revertCalls: Arguments<ImportItemBuilderOptions & ConfigurationParameters>[] = (reverter as any).calls;

      clearArray(exportCalls);
      clearArray(importCalls);
      clearArray(revertCalls);

      jest.spyOn(copyConfig, 'loadCopyConfig');
    });

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function() {
      LOG_FILENAME();

      expect(getDefaultLogPath).toHaveBeenCalledWith('item', 'copy', process.platform);
    });

    it('should call both export and import with the correct parameters', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exportCalls: Arguments<ExportItemBuilderOptions & ConfigurationParameters>[] = (exporter as any).calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importCalls: Arguments<ImportItemBuilderOptions & ConfigurationParameters>[] = (importer as any).calls;

      // TODO: mock handlers for export and import
      const argv = {
        ...yargArgs,
        ...config,

        srcRepo: 'repo1-id',

        dstRepo: 'repo2-id',

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',

        schemaId: '/./',
        name: '/./',

        mapFile: 'map.json',
        force: false,
        validate: false,
        skipIncomplete: false,

        lastPublish: true,
        publish: true,
        republish: true,

        excludeKeys: true
      };
      await handler(argv);

      expect(exportCalls.length).toEqual(1);
      expect(importCalls.length).toEqual(1);

      expect(exportCalls[0].clientId).toEqual(config.clientId);
      expect(exportCalls[0].clientSecret).toEqual(config.clientSecret);
      expect(exportCalls[0].hubId).toEqual(config.hubId);
      expect(exportCalls[0].schemaId).toEqual(argv.schemaId);
      expect(exportCalls[0].name).toEqual(argv.name);
      expect(exportCalls[0].repoId).toEqual(argv.srcRepo);
      expect(exportCalls[0].publish).toEqual(argv.lastPublish);

      expect(importCalls[0].clientId).toEqual(argv.dstClientId);
      expect(importCalls[0].clientSecret).toEqual(argv.dstSecret);
      expect(importCalls[0].hubId).toEqual(argv.dstHubId);
      expect(importCalls[0].baseRepo).toEqual(argv.dstRepo);

      expect(importCalls[0].mapFile).toEqual(argv.mapFile);
      expect(importCalls[0].force).toEqual(argv.force);
      expect(importCalls[0].validate).toEqual(argv.validate);
      expect(importCalls[0].skipIncomplete).toEqual(argv.skipIncomplete);

      expect(importCalls[0].publish).toEqual(argv.publish);
      expect(importCalls[0].republish).toEqual(argv.republish);

      expect(importCalls[0].excludeKeys).toEqual(argv.excludeKeys);
    });

    it('should forward to import-revert when revertLog is present.', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exportCalls: Arguments<ExportItemBuilderOptions & ConfigurationParameters>[] = (exporter as any).calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importCalls: Arguments<ImportItemBuilderOptions & ConfigurationParameters>[] = (importer as any).calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const revertCalls: Arguments<ImportItemBuilderOptions & ConfigurationParameters>[] = (reverter as any).calls;

      const argv = {
        ...yargArgs,
        ...config,

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',

        revertLog: 'revertTest.txt'
      };
      await handler(argv);

      expect(exportCalls.length).toEqual(0);
      expect(importCalls.length).toEqual(0);
      expect(revertCalls.length).toEqual(1);

      expect(revertCalls[0].clientId).toEqual(argv.dstClientId);
      expect(revertCalls[0].clientSecret).toEqual(argv.dstSecret);
      expect(revertCalls[0].hubId).toEqual(argv.dstHubId);
      expect(revertCalls[0].revertLog).toEqual(argv.revertLog);
    });

    it('should return false and remove temp folder when import fails or throws.', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exportCalls: Arguments<ExportItemBuilderOptions & ConfigurationParameters>[] = (exporter as any).calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importCalls: Arguments<ImportItemBuilderOptions & ConfigurationParameters>[] = (importer as any).calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (importer as any).setExpectedReturn(false);

      const argv = {
        ...yargArgs,
        ...config,

        srcRepo: 'repo1-id',

        dstRepo: 'repo2-id',

        hubId: 'hub2-id',
        clientId: 'acc2-id',
        clientSecret: 'acc2-secret',

        schemaId: '/./',
        name: '/./',

        mapFile: 'map.json',
        force: false,
        validate: false,
        skipIncomplete: false
      };
      const result = await handler(argv);

      expect(exportCalls.length).toEqual(1);
      expect(importCalls.length).toEqual(1);

      expect(result).toBeFalsy();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (importer as any).setExpectedReturn('throw');

      const result2 = await handler(argv);

      expect(result2).toBeFalsy();

      expect(exportCalls.length).toEqual(2);
      expect(importCalls.length).toEqual(2);
    });

    it('should exit when copyConfig is specified, but invalid (returns null)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exportCalls: Arguments<ExportItemBuilderOptions & ConfigurationParameters>[] = (exporter as any).calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importCalls: Arguments<ImportItemBuilderOptions & ConfigurationParameters>[] = (importer as any).calls;

      (copyConfig.loadCopyConfig as jest.Mock).mockResolvedValueOnce(null);

      // TODO: mock handlers for export and import
      const argv = {
        ...yargArgs,
        ...config,

        srcRepo: 'repo1-id',

        dstRepo: 'repo2-id',

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',

        copyConfig: 'invalid.json',
        logFile: new FileLog()
      };
      await handler(argv);

      expect(exportCalls.length).toEqual(0);
      expect(importCalls.length).toEqual(0);
    });

    it('should call both export and import with the copyConfig when given', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exportCalls: Arguments<ExportItemBuilderOptions & ConfigurationParameters>[] = (exporter as any).calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importCalls: Arguments<ImportItemBuilderOptions & ConfigurationParameters>[] = (importer as any).calls;

      const copyConfig = {
        srcHubId: 'hub2-id',
        srcClientId: 'acc2-id',
        srcSecret: 'acc2-secret',

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret'
      };

      // TODO: mock handlers for export and import
      const argv = {
        ...yargArgs,
        ...config,

        srcRepo: 'repo1-id',

        dstRepo: 'repo2-id',

        copyConfig: copyConfig,

        schemaId: '/./',
        name: '/./',

        mapFile: 'map.json',
        force: false,
        validate: false,
        skipIncomplete: false
      };
      await handler(argv);

      expect(exportCalls.length).toEqual(1);
      expect(importCalls.length).toEqual(1);

      expect(exportCalls[0].clientId).toEqual(copyConfig.srcClientId);
      expect(exportCalls[0].clientSecret).toEqual(copyConfig.srcSecret);
      expect(exportCalls[0].hubId).toEqual(copyConfig.srcHubId);
      expect(exportCalls[0].schemaId).toEqual(argv.schemaId);
      expect(exportCalls[0].name).toEqual(argv.name);
      expect(exportCalls[0].repoId).toEqual(argv.srcRepo);

      expect(importCalls[0].clientId).toEqual(copyConfig.dstClientId);
      expect(importCalls[0].clientSecret).toEqual(copyConfig.dstSecret);
      expect(importCalls[0].hubId).toEqual(copyConfig.dstHubId);
      expect(importCalls[0].baseRepo).toEqual(argv.dstRepo);

      expect(importCalls[0].mapFile).toEqual(argv.mapFile);
      expect(importCalls[0].force).toEqual(argv.force);
      expect(importCalls[0].validate).toEqual(argv.validate);
      expect(importCalls[0].skipIncomplete).toEqual(argv.skipIncomplete);
    });

    it('should not close the log if provided as part of the arguments', async () => {
      const copyConfig = {
        srcHubId: 'hub2-id',
        srcClientId: 'acc2-id',
        srcSecret: 'acc2-secret',

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret'
      };

      const log = new FileLog();
      const argv = {
        ...yargArgs,
        ...config,

        copyConfig: copyConfig,

        logFile: log
      };
      await handler(argv);

      expect(log.closed).toBeFalsy();
    });
  });
});
