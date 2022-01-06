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
import { createLog, getDefaultLogPath, openRevertLog } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';

jest.mock('../../services/dynamic-content-client-factory');

jest.mock('./export');
jest.mock('./import');
jest.mock('./import-revert');
jest.mock('../../common/log-helpers', () => ({
  ...jest.requireActual('../../common/log-helpers'),
  getDefaultLogPath: jest.fn()
}));

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
          'Path to a log file to revert a copy for. This will archive the most recently copied resources, and revert updated ones.',
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
          "Copy content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
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

      expect(spyOption).toHaveBeenCalledWith('lastPublish', {
        type: 'boolean',
        boolean: true,
        describe: 'When available, export the last published version of a content item rather than its newest version.'
      });

      expect(spyOption).toHaveBeenCalledWith('publish', {
        type: 'boolean',
        boolean: true,
        describe:
          'Publish any content items that either made a new version on import, or were published more recently in the JSON.'
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
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/copy/`);
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

        facet: 'name:/./,schema:/./',

        mapFile: 'map.json',
        force: false,
        validate: false,
        skipIncomplete: false,

        lastPublish: true,
        publish: true,
        republish: true,

        excludeKeys: true,
        media: true
      };
      await handler(argv);

      expect(exportCalls.length).toEqual(1);
      expect(importCalls.length).toEqual(1);

      expect(exportCalls[0].clientId).toEqual(config.clientId);
      expect(exportCalls[0].clientSecret).toEqual(config.clientSecret);
      expect(exportCalls[0].hubId).toEqual(config.hubId);
      expect(exportCalls[0].facet).toEqual(argv.facet);
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
      expect(importCalls[0].media).toEqual(argv.media);
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

        revertLog: Promise.resolve(new FileLog())
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

    it('should exit early when revertLog is not present.', async () => {
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

        revertLog: openRevertLog(`temp_${process.env.JEST_WORKER_ID}/copy/revertMissing.txt`)
      };
      await handler(argv);

      expect(exportCalls.length).toEqual(0);
      expect(importCalls.length).toEqual(0);
      expect(revertCalls.length).toEqual(0);
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

        facet: 'name:/./,schema:/./',

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

    it('should close the log if provided as part of the arguments', async () => {
      const log = new FileLog();

      // TODO: mock handlers for export and import
      const argv = {
        ...yargArgs,
        ...config,

        srcRepo: 'repo1-id',

        dstRepo: 'repo2-id',

        facet: 'name:/./,schema:/./',

        mapFile: 'map.json',
        logFile: log,
        force: false,
        validate: false,
        skipIncomplete: false
      };

      await handler(argv);

      expect(log.closed).toBeTruthy();
    });

    it('should not close the log if previously opened', async () => {
      const copyConfig = {
        srcHubId: 'hub2-id',
        srcClientId: 'acc2-id',
        srcSecret: 'acc2-secret',

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret'
      };

      const log = new FileLog().open();
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
