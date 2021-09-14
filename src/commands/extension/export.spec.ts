import * as exportModule from './export';
import * as directoryUtils from '../../common/import/directory-utils';
import {
  builder,
  command,
  filterExtensionsById,
  getExtensionExports,
  getExportRecordForExtension,
  handler,
  LOG_FILENAME,
  processExtensions
} from './export';
import Yargs from 'yargs/yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Extension } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import * as exportServiceModule from '../../services/export.service';
import { table } from 'table';
import chalk from 'chalk';
import { loadJsonFromDirectory } from '../../services/import.service';
import { FileLog } from '../../common/file-log';
import { streamTableOptions } from '../../common/table/table.consts';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { validateNoDuplicateExtensionNames } from './import';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('./import');
jest.mock('../../services/import.service');
jest.mock('../../common/import/directory-utils');
jest.mock('table');
jest.mock('../../common/log-helpers');

describe('extension export command', (): void => {
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
        describe: 'Output directory for the exported Extensions',
        type: 'string'
      });
      expect(spyOption).toHaveBeenCalledWith('id', {
        type: 'string',
        describe:
          'The ID of an Extension to be exported.\nIf no --id option is given, all extensions for the hub are exported.\nA single --id option may be given to export a single extension.\nMultiple --id options may be given to export multiple extensions at the same time.',
        requiresArg: true
      });
      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'Overwrite extensions without asking.'
      });
      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: createLog
      });
    });
  });

  describe('getExports', () => {
    let getExportRecordForExtensionSpy: jest.SpyInstance;

    const extensionsToExport = [
      new Extension({
        name: 'extension-name-1',
        label: 'extension 1'
      }),
      new Extension({
        name: 'extension-name-2',
        label: 'extension 2'
      })
    ];

    const exportedExtensions = {
      'export-dir/export-filename-1.json': extensionsToExport[0],
      'export-dir/export-filename-2.json': extensionsToExport[1]
    };

    beforeEach(() => {
      getExportRecordForExtensionSpy = jest.spyOn(exportModule, 'getExportRecordForExtension');
    });

    it('should return a list of extensions to export and no filenames that will be updated (first export)', () => {
      getExportRecordForExtensionSpy
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-1.json',
          status: 'CREATED',
          extension: extensionsToExport[0]
        })
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-2.json',
          status: 'CREATED',
          extension: extensionsToExport[1]
        });

      const [allExports, updatedExportsMap] = getExtensionExports('export-dir', {}, extensionsToExport);

      expect(getExportRecordForExtensionSpy).toHaveBeenCalledTimes(2);
      expect(getExportRecordForExtensionSpy.mock.calls).toMatchSnapshot();
      expect(allExports).toMatchSnapshot();
      expect(updatedExportsMap).toEqual([]);
    });

    it('should return a list of extensions to export and a list of filenames that will be updated', () => {
      getExportRecordForExtensionSpy
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-1.json',
          status: 'CREATED',
          extension: extensionsToExport[0]
        })
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-2.json',
          status: 'UPDATED',
          extension: extensionsToExport[1]
        });

      const [allExports, updatedExportsMap] = getExtensionExports('export-dir', exportedExtensions, extensionsToExport);

      expect(getExportRecordForExtensionSpy).toHaveBeenCalledTimes(2);
      expect(getExportRecordForExtensionSpy.mock.calls).toMatchSnapshot();
      expect(allExports).toMatchSnapshot();
      expect(updatedExportsMap).toMatchSnapshot();
    });

    it('should not return a list of extensions to export or a list of filenames that will be updated', () => {
      const [allExports, updatedExportsMap] = getExtensionExports('export-dir', {}, []);

      expect(getExportRecordForExtensionSpy).toHaveBeenCalledTimes(0);
      expect(allExports).toEqual([]);
      expect(updatedExportsMap).toEqual([]);
    });

    it('should skip any that are missing a name', () => {
      const [allExports, updatedExportsMap] = getExtensionExports('export-dir', {}, [
        new Extension({
          label: 'extension 1'
        })
      ]);

      expect(getExportRecordForExtensionSpy).toHaveBeenCalledTimes(0);
      expect(allExports).toEqual([]);
      expect(updatedExportsMap).toEqual([]);
    });
  });

  describe('getExportRecordForExtension', () => {
    it('should create export for any newly exported extension', async () => {
      const exportedExtensions = {
        'export-dir/export-filename-1.json': new Extension({
          name: 'extension-name-1',
          label: 'extension 1'
        }),
        'export-dir/export-filename-2.json': new Extension({
          name: 'extension-name-2',
          label: 'extension 2'
        })
      };
      const newExtensionToExport = new Extension({
        name: 'extension-name-3',
        label: 'extension 3'
      });

      jest.spyOn(exportServiceModule, 'uniqueFilenamePath').mockReturnValueOnce('export-dir/export-filename-3.json');

      const existingExtensions = Object.keys(exportedExtensions);

      const result = getExportRecordForExtension(newExtensionToExport, 'export-dir', exportedExtensions);

      expect(exportServiceModule.uniqueFilenamePath).toHaveBeenCalledWith(
        'export-dir',
        newExtensionToExport.name,
        'json',
        existingExtensions
      );
      expect(result).toEqual({
        filename: 'export-dir/export-filename-3.json',
        status: 'CREATED',
        extension: newExtensionToExport
      });
    });

    it('should update export for any extension with different content', async () => {
      const exportedExtensions = {
        'export-dir/export-filename-1.json': new Extension({
          name: 'extension-name-1',
          label: 'extension 1'
        }),
        'export-dir/export-filename-2.json': new Extension({
          name: 'extension-name-2',
          label: 'extension 2'
        })
      };
      const updatedExtensionToExport = new Extension({
        id: 'extension-id-2',
        name: 'extension-name-2',
        label: 'extension 2 - mutated label'
      });

      jest.spyOn(exportServiceModule, 'uniqueFilenamePath');

      const result = getExportRecordForExtension(updatedExtensionToExport, 'export-dir', exportedExtensions);

      expect(exportServiceModule.uniqueFilenamePath).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        filename: 'export-dir/export-filename-2.json',
        status: 'UPDATED',
        extension: updatedExtensionToExport
      });
    });

    it('should not update export for any extension with same content', async () => {
      const exportedExtensions = {
        'export-dir/export-filename-1.json': new Extension({
          name: 'extension-name-1',
          label: 'extension 1'
        }),
        'export-dir/export-filename-2.json': new Extension({
          name: 'extension-name-2',
          label: 'extension 2'
        })
      };
      const unchangedExtensionToExport = new Extension({
        id: 'extension-id-2',
        name: 'extension-name-2',
        label: 'extension 2'
      });

      jest.spyOn(exportServiceModule, 'uniqueFilenamePath');

      const result = getExportRecordForExtension(unchangedExtensionToExport, 'export-dir', exportedExtensions);

      expect(exportServiceModule.uniqueFilenamePath).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        filename: 'export-dir/export-filename-2.json',
        status: 'UP-TO-DATE',
        extension: unchangedExtensionToExport
      });
    });
  });

  describe('filterExtensionsById', () => {
    const listToFilter = [
      new Extension({
        id: 'extension-id-1',
        label: 'extension 1'
      }),
      new Extension({
        id: 'extension-id-2',
        label: 'extension 2'
      }),
      new Extension({
        id: 'extension-id-3',
        label: 'extension 3'
      })
    ];

    it('should return the extensions matching the given uris', async () => {
      const result = filterExtensionsById(listToFilter, ['extension-id-1', 'extension-id-3']);
      expect(result).toEqual(expect.arrayContaining([listToFilter[0], listToFilter[2]]));
    });

    it('should return all the extensions because there are no URIs to filter', async () => {
      const result = filterExtensionsById(listToFilter, []);
      expect(result).toEqual(listToFilter);
    });

    it('should throw an error for ids which do not exist in the list of extensions', async () => {
      expect(() =>
        filterExtensionsById(listToFilter, ['extension-id-1', 'extension-id-4', 'extension-id-3'])
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('processExtensions', () => {
    let mockEnsureDirectory: jest.Mock;
    let mockTable: jest.Mock;
    let stdoutSpy: jest.SpyInstance;

    const extensionsToProcess = [
      new Extension({
        id: 'extension-id-1',
        name: 'extension-name-1',
        label: 'extension 1',
        status: 'ACTIVE'
      }),
      new Extension({
        id: 'extension-id-2',
        name: 'extension-name-2',
        label: 'extension 2',
        status: 'ACTIVE'
      }),
      new Extension({
        id: 'extension-id-3',
        name: 'extension-name-3',
        label: 'extension 3',
        status: 'ACTIVE'
      })
    ];

    const exportedExtensions = [
      {
        name: 'extension-name-1',
        label: 'extension 1',
        status: 'ACTIVE'
      },
      {
        name: 'extension-name-2',
        label: 'extension 2',
        status: 'ACTIVE'
      },
      {
        name: 'extension-name-3',
        label: 'extension 3',
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

    it('should output export files for the given extensions if nothing previously exported', async () => {
      jest.spyOn(exportModule, 'getExtensionExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'CREATED',
            extension: extensionsToProcess[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'CREATED',
            extension: extensionsToProcess[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'CREATED',
            extension: extensionsToProcess[2]
          }
        ],
        []
      ]);

      const previouslyExportedExtensions = {};
      await processExtensions('export-dir', previouslyExportedExtensions, extensionsToProcess, new FileLog(), false);

      expect(exportModule.getExtensionExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getExtensionExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedExtensions,
        extensionsToProcess
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);

      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(3);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        1,
        'export-dir/export-filename-1.json',
        expect.objectContaining(exportedExtensions[0])
      );
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        2,
        'export-dir/export-filename-2.json',
        expect.objectContaining(exportedExtensions[1])
      );
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        3,
        'export-dir/export-filename-3.json',
        expect.objectContaining(exportedExtensions[2])
      );

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('File'), chalk.bold('Name'), chalk.bold('Result')],
          ['export-dir/export-filename-1.json', extensionsToProcess[0].name, 'CREATED'],
          ['export-dir/export-filename-2.json', extensionsToProcess[1].name, 'CREATED'],
          ['export-dir/export-filename-3.json', extensionsToProcess[2].name, 'CREATED']
        ],
        streamTableOptions
      );
    });

    it('should output a message if no extensions to export from hub', async () => {
      jest.spyOn(exportModule, 'getExtensionExports').mockReturnValueOnce([[], []]);

      const previouslyExportedExtensions = {};

      await processExtensions('export-dir', previouslyExportedExtensions, [], new FileLog(), false);

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(0);
      expect(exportModule.getExtensionExports).toHaveBeenCalledTimes(0);
      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(0);
      expect(mockTable).toHaveBeenCalledTimes(0);
    });

    it('should not output any export files if a previous export exists and the extension is unchanged', async () => {
      jest.spyOn(exportModule, 'getExtensionExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            extension: extensionsToProcess[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UP-TO-DATE',
            extension: extensionsToProcess[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UP-TO-DATE',
            extension: extensionsToProcess[2]
          }
        ],
        []
      ]);

      const previouslyExportedExtensions = {
        'export-dir/export-filename-2.json': new Extension(exportedExtensions[1])
      };
      await processExtensions('export-dir', previouslyExportedExtensions, extensionsToProcess, new FileLog(), false);

      expect(exportModule.getExtensionExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getExtensionExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedExtensions,
        extensionsToProcess
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(0);

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('File'), chalk.bold('Name'), chalk.bold('Result')],
          ['export-dir/export-filename-1.json', extensionsToProcess[0].name, 'UP-TO-DATE'],
          ['export-dir/export-filename-2.json', extensionsToProcess[1].name, 'UP-TO-DATE'],
          ['export-dir/export-filename-3.json', extensionsToProcess[2].name, 'UP-TO-DATE']
        ],
        streamTableOptions
      );
    });

    it('should update the existing export file for a changed extension', async () => {
      const mutatedExtensions = [...extensionsToProcess];
      mutatedExtensions[1] = new Extension({
        id: 'extension-id-2',
        name: 'extension-name-2',
        label: 'extension 2 - mutated label',
        status: 'ACTIVE'
      });

      jest.spyOn(exportServiceModule, 'promptToOverwriteExports').mockResolvedValueOnce(true);

      jest.spyOn(exportModule, 'getExtensionExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            extension: mutatedExtensions[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UPDATED',
            extension: mutatedExtensions[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UP-TO-DATE',
            extension: mutatedExtensions[2]
          }
        ],
        [
          {
            filename: 'export-dir/export-filename-2.json',
            uri: mutatedExtensions[1].id as string
          }
        ]
      ]);

      const previouslyExportedExtensions = {
        'export-dir/export-filename-2.json': new Extension(exportedExtensions[1])
      };

      await processExtensions('export-dir', previouslyExportedExtensions, mutatedExtensions, new FileLog(), false);

      expect(exportModule.getExtensionExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getExtensionExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedExtensions,
        mutatedExtensions
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(1);

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('File'), chalk.bold('Name'), chalk.bold('Result')],
          ['export-dir/export-filename-1.json', extensionsToProcess[0].name, 'UP-TO-DATE'],
          ['export-dir/export-filename-2.json', extensionsToProcess[1].name, 'UPDATED'],
          ['export-dir/export-filename-3.json', extensionsToProcess[2].name, 'UP-TO-DATE']
        ],
        streamTableOptions
      );
    });

    it('should not update anything if the user says "n" to the overwrite prompt', async () => {
      const mutatedExtensions = [...extensionsToProcess];
      mutatedExtensions[1] = new Extension({
        id: 'extension-id-2',
        name: 'extension-name-2',
        label: 'extension 2 - mutated label',
        status: 'ACTIVE'
      });

      jest.spyOn(exportServiceModule, 'promptToOverwriteExports').mockResolvedValueOnce(false);
      jest.spyOn(exportModule, 'getExtensionExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            extension: mutatedExtensions[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UPDATED',
            extension: mutatedExtensions[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UP-TO-DATE',
            extension: mutatedExtensions[2]
          }
        ],
        [
          {
            filename: 'export-dir/export-filename-2.json',
            uri: mutatedExtensions[1].id as string
          }
        ]
      ]);

      const previouslyExportedExtensions = {
        'export-dir/export-filename-2.json': new Extension(exportedExtensions[1])
      };

      await processExtensions('export-dir', previouslyExportedExtensions, mutatedExtensions, new FileLog(), false);

      expect(exportModule.getExtensionExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getExtensionExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedExtensions,
        mutatedExtensions
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(0);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(0);
      expect(mockTable).toHaveBeenCalledTimes(0);
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

    const extensionsToExport: Extension[] = [
      new Extension({
        id: 'extension-id-1',
        name: 'extension-name-1',
        label: 'extension-label-1',
        status: 'ACTIVE',
        settings:
          '{"API":{"READ":true,"EDIT":true},"SANDBOX":{"SAME_ORIGIN":true,"MODALS":true,"NAVIGATION":true,"POPUPS":true,"POPUP_ESCAPE_SANDBOX":true,"DOWNLOADS":true,"FORMS":true}}'
      }),
      new Extension({
        id: 'extension-id-2',
        name: 'extension-name-2',
        label: 'extension-label-2',
        status: 'ACTIVE',
        settings:
          '{"API":{"READ":true,"EDIT":true},"SANDBOX":{"SAME_ORIGIN":true,"MODALS":true,"NAVIGATION":true,"POPUPS":true,"POPUP_ESCAPE_SANDBOX":true,"DOWNLOADS":true,"FORMS":true}}'
      })
    ];

    let mockGetHub: jest.Mock;
    let mockList: jest.Mock;

    beforeEach(() => {
      (loadJsonFromDirectory as jest.Mock).mockReturnValue([]);

      const listResponse = new MockPage(Extension, extensionsToExport);
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
      jest.spyOn(exportModule, 'processExtensions').mockResolvedValue();
    });

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function() {
      LOG_FILENAME();

      expect(getDefaultLogPath).toHaveBeenCalledWith('extension', 'export', process.platform);
    });

    it('should export all extensions for the current hub if no ids specified', async (): Promise<void> => {
      const extensionIdsToExport: string[] | undefined = undefined;
      const argv = { ...yargArgs, ...config, dir: 'my-dir', extensionId: extensionIdsToExport, logFile: new FileLog() };

      const filteredExtensionsToExport = [...extensionsToExport];
      jest.spyOn(exportModule, 'filterExtensionsById').mockReturnValue(filteredExtensionsToExport);

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalledTimes(1);
      expect(mockList).toHaveBeenCalledWith({ size: 100 });
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, Extension);
      expect(validateNoDuplicateExtensionNames).toHaveBeenCalled();
      expect(exportModule.filterExtensionsById).toHaveBeenCalledWith(extensionsToExport, []);
      expect(exportModule.processExtensions).toHaveBeenCalledWith(
        argv.dir,
        [],
        filteredExtensionsToExport,
        expect.any(FileLog),
        false
      );
    });

    it('should export only selected extensions if ids specified', async (): Promise<void> => {
      const idsToExport: string[] | undefined = ['extension-id-2'];
      const argv = { ...yargArgs, ...config, dir: 'my-dir', id: idsToExport, logFile: new FileLog() };

      const filteredExtensionsToExport = [extensionsToExport[1]];
      jest.spyOn(exportModule, 'filterExtensionsById').mockReturnValue(filteredExtensionsToExport);

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalled();
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, Extension);
      expect(validateNoDuplicateExtensionNames).toHaveBeenCalled();
      expect(exportModule.filterExtensionsById).toHaveBeenCalledWith(extensionsToExport, idsToExport);
      expect(exportModule.processExtensions).toHaveBeenCalledWith(
        argv.dir,
        [],
        filteredExtensionsToExport,
        expect.any(FileLog),
        false
      );
    });
  });
});
