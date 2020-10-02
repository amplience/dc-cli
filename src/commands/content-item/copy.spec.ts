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

jest.mock('../../services/dynamic-content-client-factory');

jest.mock('./export');
jest.mock('./import');
jest.mock('./import-revert');

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

      expect(spyOption).toHaveBeenCalledWith('dstHub', {
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

        dstHub: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',

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

      expect(exportCalls[0].clientId).toEqual(config.clientId);
      expect(exportCalls[0].clientSecret).toEqual(config.clientSecret);
      expect(exportCalls[0].hubId).toEqual(config.hubId);
      expect(exportCalls[0].schemaId).toEqual(argv.schemaId);
      expect(exportCalls[0].name).toEqual(argv.name);
      expect(exportCalls[0].repoId).toEqual(argv.srcRepo);

      expect(importCalls[0].clientId).toEqual(argv.dstClientId);
      expect(importCalls[0].clientSecret).toEqual(argv.dstSecret);
      expect(importCalls[0].hubId).toEqual(argv.dstHub);
      expect(importCalls[0].baseRepo).toEqual(argv.dstRepo);

      expect(importCalls[0].mapFile).toEqual(argv.mapFile);
      expect(importCalls[0].force).toEqual(argv.force);
      expect(importCalls[0].validate).toEqual(argv.validate);
      expect(importCalls[0].skipIncomplete).toEqual(argv.skipIncomplete);
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

        dstHub: 'hub2-id',
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
      expect(revertCalls[0].hubId).toEqual(argv.dstHub);
      expect(revertCalls[0].revertLog).toEqual(argv.revertLog);
    });
  });
});
