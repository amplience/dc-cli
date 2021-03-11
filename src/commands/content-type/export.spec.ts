import * as exportModule from './export';
import * as directoryUtils from '../../common/import/directory-utils';
import {
  builder,
  command,
  filterContentTypesByUri,
  getContentTypeExports,
  getExportRecordForContentType,
  handler,
  LOG_FILENAME,
  processContentTypes
} from './export';
import Yargs from 'yargs/yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import * as exportServiceModule from '../../services/export.service';
import { table } from 'table';
import chalk from 'chalk';
import { validateNoDuplicateContentTypeUris } from './import';
import { loadJsonFromDirectory } from '../../services/import.service';
import { FileLog } from '../../common/file-log';
import { streamTableOptions } from '../../common/table/table.consts';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('./import');
jest.mock('../../services/import.service');
jest.mock('../../common/import/directory-utils');
jest.mock('table');

describe('content-type export command', (): void => {
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
        describe: 'Output directory for the exported Content Type definitions',
        type: 'string'
      });
      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        describe:
          'The Schema ID of a Content Type to be exported.\nIf no --schemaId option is given, all content types for the hub are exported.\nA single --schemaId option may be given to export a single content type.\nMultiple --schemaId options may be given to export multiple content types at the same time.',
        requiresArg: true
      });
      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'Overwrite content types without asking.'
      });
      expect(spyOption).toHaveBeenCalledWith('archived', {
        type: 'boolean',
        describe: 'If present, archived content types will also be considered.',
        boolean: true
      });
      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.'
      });
    });
  });

  describe('getExports', () => {
    let getExportRecordForContentTypeSpy: jest.SpyInstance;

    const contentTypesToExport = [
      new ContentType({
        contentTypeUri: 'content-type-uri-1',
        settings: {
          label: 'content type 1'
        }
      }),
      new ContentType({
        contentTypeUri: 'content-type-uri-2',
        settings: {
          label: 'content type 2'
        }
      })
    ];

    const exportedContentTypes = {
      'export-dir/export-filename-1.json': contentTypesToExport[0],
      'export-dir/export-filename-2.json': contentTypesToExport[1]
    };

    beforeEach(() => {
      getExportRecordForContentTypeSpy = jest.spyOn(exportModule, 'getExportRecordForContentType');
    });

    it('should return a list of content-types to export and no filenames that will be updated (first export)', () => {
      getExportRecordForContentTypeSpy
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-1.json',
          status: 'CREATED',
          contentType: contentTypesToExport[0]
        })
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-2.json',
          status: 'CREATED',
          contentType: contentTypesToExport[1]
        });

      const [allExports, updatedExportsMap] = getContentTypeExports('export-dir', {}, contentTypesToExport);

      expect(getExportRecordForContentTypeSpy).toHaveBeenCalledTimes(2);
      expect(getExportRecordForContentTypeSpy.mock.calls).toMatchSnapshot();
      expect(allExports).toMatchSnapshot();
      expect(updatedExportsMap).toEqual([]);
    });

    it('should return a list of content-types to export and a list of filenames that will be updated', () => {
      getExportRecordForContentTypeSpy
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-1.json',
          status: 'CREATED',
          contentType: contentTypesToExport[0]
        })
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-2.json',
          status: 'UPDATED',
          contentType: contentTypesToExport[1]
        });

      const [allExports, updatedExportsMap] = getContentTypeExports(
        'export-dir',
        exportedContentTypes,
        contentTypesToExport
      );

      expect(getExportRecordForContentTypeSpy).toHaveBeenCalledTimes(2);
      expect(getExportRecordForContentTypeSpy.mock.calls).toMatchSnapshot();
      expect(allExports).toMatchSnapshot();
      expect(updatedExportsMap).toMatchSnapshot();
    });

    it('should not return a list of content-types to export or a list of filenames that will be updated', () => {
      const [allExports, updatedExportsMap] = getContentTypeExports('export-dir', {}, []);

      expect(getExportRecordForContentTypeSpy).toHaveBeenCalledTimes(0);
      expect(allExports).toEqual([]);
      expect(updatedExportsMap).toEqual([]);
    });

    it('should skip any that are missing a contetTypeUri', () => {
      const [allExports, updatedExportsMap] = getContentTypeExports('export-dir', {}, [
        new ContentType({
          settings: {
            label: 'content type 1'
          }
        })
      ]);

      expect(getExportRecordForContentTypeSpy).toHaveBeenCalledTimes(0);
      expect(allExports).toEqual([]);
      expect(updatedExportsMap).toEqual([]);
    });
  });

  describe('getExportRecordForContentType', () => {
    it('should create export for any newly exported content-type', async () => {
      const exportedContentTypes = {
        'export-dir/export-filename-1.json': new ContentType({
          contentTypeUri: 'content-type-uri-1',
          settings: {
            label: 'content type 1'
          }
        }),
        'export-dir/export-filename-2.json': new ContentType({
          contentTypeUri: 'content-type-uri-2',
          settings: {
            label: 'content type 2'
          }
        })
      };
      const newContentTypeToExport = new ContentType({
        contentTypeUri: 'content-type-uri-3',
        settings: {
          label: 'content type 3'
        }
      });

      jest.spyOn(exportServiceModule, 'uniqueFilename').mockReturnValueOnce('export-dir/export-filename-3.json');

      const existingTypes = Object.keys(exportedContentTypes);

      const result = getExportRecordForContentType(newContentTypeToExport, 'export-dir', exportedContentTypes);

      expect(exportServiceModule.uniqueFilename).toHaveBeenCalledWith(
        'export-dir',
        newContentTypeToExport.contentTypeUri,
        'json',
        existingTypes
      );
      expect(result).toEqual({
        filename: 'export-dir/export-filename-3.json',
        status: 'CREATED',
        contentType: newContentTypeToExport
      });
    });

    it('should update export for any content-type with different content', async () => {
      const exportedContentTypes = {
        'export-dir/export-filename-1.json': new ContentType({
          contentTypeUri: 'content-type-uri-1',
          settings: {
            label: 'content type 1'
          }
        }),
        'export-dir/export-filename-2.json': new ContentType({
          contentTypeUri: 'content-type-uri-2',
          settings: {
            label: 'content type 2'
          }
        })
      };
      const updatedContentTypeToExport = new ContentType({
        id: 'content-type-id-2',
        contentTypeUri: 'content-type-uri-2',
        settings: {
          label: 'content type 2 - mutated label'
        }
      });

      jest.spyOn(exportServiceModule, 'uniqueFilename');

      const result = getExportRecordForContentType(updatedContentTypeToExport, 'export-dir', exportedContentTypes);

      expect(exportServiceModule.uniqueFilename).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        filename: 'export-dir/export-filename-2.json',
        status: 'UPDATED',
        contentType: updatedContentTypeToExport
      });
    });

    it('should not update export for any content-type with same content', async () => {
      const exportedContentTypes = {
        'export-dir/export-filename-1.json': new ContentType({
          contentTypeUri: 'content-type-uri-1',
          settings: {
            label: 'content type 1'
          }
        }),
        'export-dir/export-filename-2.json': new ContentType({
          contentTypeUri: 'content-type-uri-2',
          settings: {
            label: 'content type 2'
          }
        })
      };
      const unchangedContentTypeToExport = new ContentType({
        id: 'content-type-id-2',
        contentTypeUri: 'content-type-uri-2',
        settings: {
          label: 'content type 2'
        }
      });

      jest.spyOn(exportServiceModule, 'uniqueFilename');

      const result = getExportRecordForContentType(unchangedContentTypeToExport, 'export-dir', exportedContentTypes);

      expect(exportServiceModule.uniqueFilename).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        filename: 'export-dir/export-filename-2.json',
        status: 'UP-TO-DATE',
        contentType: unchangedContentTypeToExport
      });
    });
  });

  describe('filterContentTypesByUri', () => {
    const listToFilter = [
      new ContentType({
        contentTypeUri: 'content-type-uri-1',
        settings: {
          label: 'content type 1'
        }
      }),
      new ContentType({
        contentTypeUri: 'content-type-uri-2',
        settings: {
          label: 'content type 2'
        }
      }),
      new ContentType({
        contentTypeUri: 'content-type-uri-3',
        settings: {
          label: 'content type 3'
        }
      })
    ];

    it('should return the content types matching the given uris', async () => {
      const result = filterContentTypesByUri(listToFilter, ['content-type-uri-1', 'content-type-uri-3']);
      expect(result).toEqual(expect.arrayContaining([listToFilter[0], listToFilter[2]]));
    });

    it('should return all the content types because there are no URIs to filter', async () => {
      const result = filterContentTypesByUri(listToFilter, []);
      expect(result).toEqual(listToFilter);
    });

    it('should throw an error for uris which do not exist in the list of content types', async () => {
      expect(() =>
        filterContentTypesByUri(listToFilter, ['content-type-uri-1', 'content-type-uri-4', 'content-type-uri-3'])
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('processContentTypes', () => {
    let mockEnsureDirectory: jest.Mock;
    let mockTable: jest.Mock;
    let stdoutSpy: jest.SpyInstance;

    const contentTypesToProcess = [
      new ContentType({
        id: 'content-type-id-1',
        contentTypeUri: 'content-type-uri-1',
        settings: { label: 'content type 1' }
      }),
      new ContentType({
        id: 'content-type-id-2',
        contentTypeUri: 'content-type-uri-2',
        settings: { label: 'content type 2' }
      }),
      new ContentType({
        id: 'content-type-id-3',
        contentTypeUri: 'content-type-uri-3',
        settings: { label: 'content type 3' }
      })
    ];

    const exportedContentTypes = [
      {
        contentTypeUri: 'content-type-uri-1',
        settings: { label: 'content type 1' }
      },
      {
        contentTypeUri: 'content-type-uri-2',
        settings: { label: 'content type 2' }
      },
      {
        contentTypeUri: 'content-type-uri-3',
        settings: { label: 'content type 3' }
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

    it('should output export files for the given content types if nothing previously exported', async () => {
      jest.spyOn(exportModule, 'getContentTypeExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'CREATED',
            contentType: contentTypesToProcess[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'CREATED',
            contentType: contentTypesToProcess[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'CREATED',
            contentType: contentTypesToProcess[2]
          }
        ],
        []
      ]);

      const previouslyExportedContentTypes = {};
      await processContentTypes(
        'export-dir',
        previouslyExportedContentTypes,
        contentTypesToProcess,
        new FileLog(),
        false
      );

      expect(exportModule.getContentTypeExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getContentTypeExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedContentTypes,
        contentTypesToProcess
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);

      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(3);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        1,
        'export-dir/export-filename-1.json',
        expect.objectContaining(exportedContentTypes[0])
      );
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        2,
        'export-dir/export-filename-2.json',
        expect.objectContaining(exportedContentTypes[1])
      );
      expect(exportServiceModule.writeJsonToFile).toHaveBeenNthCalledWith(
        3,
        'export-dir/export-filename-3.json',
        expect.objectContaining(exportedContentTypes[2])
      );

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('File'), chalk.bold('Schema ID'), chalk.bold('Result')],
          ['export-dir/export-filename-1.json', exportedContentTypes[0].contentTypeUri, 'CREATED'],
          ['export-dir/export-filename-2.json', exportedContentTypes[1].contentTypeUri, 'CREATED'],
          ['export-dir/export-filename-3.json', exportedContentTypes[2].contentTypeUri, 'CREATED']
        ],
        streamTableOptions
      );
    });

    it('should output a message if no content types to export from hub', async () => {
      jest.spyOn(exportModule, 'getContentTypeExports').mockReturnValueOnce([[], []]);

      const previouslyExportedContentTypes = {};

      await processContentTypes('export-dir', previouslyExportedContentTypes, [], new FileLog(), false);

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(0);
      expect(exportModule.getContentTypeExports).toHaveBeenCalledTimes(0);
      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(0);
      expect(mockTable).toHaveBeenCalledTimes(0);
    });

    it('should not output any export files if a previous export exists and the content type is unchanged', async () => {
      jest.spyOn(exportModule, 'getContentTypeExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            contentType: contentTypesToProcess[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UP-TO-DATE',
            contentType: contentTypesToProcess[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UP-TO-DATE',
            contentType: contentTypesToProcess[2]
          }
        ],
        []
      ]);

      const previouslyExportedContentTypes = {
        'export-dir/export-filename-2.json': new ContentType(exportedContentTypes[1])
      };
      await processContentTypes(
        'export-dir',
        previouslyExportedContentTypes,
        contentTypesToProcess,
        new FileLog(),
        false
      );

      expect(exportModule.getContentTypeExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getContentTypeExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedContentTypes,
        contentTypesToProcess
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(0);

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('File'), chalk.bold('Schema ID'), chalk.bold('Result')],
          ['export-dir/export-filename-1.json', exportedContentTypes[0].contentTypeUri, 'UP-TO-DATE'],
          ['export-dir/export-filename-2.json', exportedContentTypes[1].contentTypeUri, 'UP-TO-DATE'],
          ['export-dir/export-filename-3.json', exportedContentTypes[2].contentTypeUri, 'UP-TO-DATE']
        ],
        streamTableOptions
      );
    });

    it('should update the existing export file for a changed content type', async () => {
      const mutatedContentTypes = [...contentTypesToProcess];
      mutatedContentTypes[1] = new ContentType({
        id: 'content-type-id-2',
        contentTypeUri: 'content-type-uri-2',
        settings: { label: 'content type 2 - mutated label' }
      });

      jest.spyOn(exportServiceModule, 'promptToOverwriteExports').mockResolvedValueOnce(true);

      jest.spyOn(exportModule, 'getContentTypeExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            contentType: mutatedContentTypes[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UPDATED',
            contentType: mutatedContentTypes[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UP-TO-DATE',
            contentType: mutatedContentTypes[2]
          }
        ],
        [
          {
            filename: 'export-dir/export-filename-2.json',
            uri: mutatedContentTypes[1].contentTypeUri as string
          }
        ]
      ]);

      const previouslyExportedContentTypes = {
        'export-dir/export-filename-2.json': new ContentType(exportedContentTypes[1])
      };

      await processContentTypes(
        'export-dir',
        previouslyExportedContentTypes,
        mutatedContentTypes,
        new FileLog(),
        false
      );

      expect(exportModule.getContentTypeExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getContentTypeExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedContentTypes,
        mutatedContentTypes
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(1);

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('File'), chalk.bold('Schema ID'), chalk.bold('Result')],
          ['export-dir/export-filename-1.json', exportedContentTypes[0].contentTypeUri, 'UP-TO-DATE'],
          ['export-dir/export-filename-2.json', exportedContentTypes[1].contentTypeUri, 'UPDATED'],
          ['export-dir/export-filename-3.json', exportedContentTypes[2].contentTypeUri, 'UP-TO-DATE']
        ],
        streamTableOptions
      );
    });

    it('should not update anything if the user says "n" to the overwrite prompt', async () => {
      const mutatedContentTypes = [...contentTypesToProcess];
      mutatedContentTypes[1] = new ContentType({
        id: 'content-type-id-2',
        contentTypeUri: 'content-type-uri-2',
        settings: { label: 'content type 2 - mutated label' }
      });

      jest.spyOn(exportServiceModule, 'promptToOverwriteExports').mockResolvedValueOnce(false);
      jest.spyOn(exportModule, 'getContentTypeExports').mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            contentType: mutatedContentTypes[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UPDATED',
            contentType: mutatedContentTypes[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UP-TO-DATE',
            contentType: mutatedContentTypes[2]
          }
        ],
        [
          {
            filename: 'export-dir/export-filename-2.json',
            uri: mutatedContentTypes[1].contentTypeUri as string
          }
        ]
      ]);

      const previouslyExportedContentTypes = {
        'export-dir/export-filename-2.json': new ContentType(exportedContentTypes[1])
      };

      await processContentTypes(
        'export-dir',
        previouslyExportedContentTypes,
        mutatedContentTypes,
        new FileLog(),
        false
      );

      expect(exportModule.getContentTypeExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getContentTypeExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedContentTypes,
        mutatedContentTypes
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

    const contentTypesToExport: ContentType[] = [
      new ContentType({
        id: 'content-type-id-1',
        contentTypeUri: 'content-type-uri-1',
        settings: {
          label: 'content-type-label-1'
        }
      }),
      new ContentType({
        id: 'content-type-id-2',
        contentTypeUri: 'content-type-uri-2',
        settings: { label: 'content-type-label-2' }
      })
    ];

    let mockGetHub: jest.Mock;
    let mockList: jest.Mock;

    beforeEach(() => {
      (loadJsonFromDirectory as jest.Mock).mockReturnValue([]);
      (validateNoDuplicateContentTypeUris as jest.Mock).mockImplementation();

      const listResponse = new MockPage(ContentType, contentTypesToExport);
      mockList = jest.fn().mockResolvedValue(listResponse);

      mockGetHub = jest.fn().mockResolvedValue({
        related: {
          contentTypes: {
            list: mockList
          }
        }
      });

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });
      jest.spyOn(exportModule, 'processContentTypes').mockResolvedValue();
    });

    function expectProcessArguments(dir: string, types: ContentType[]): void {
      expect((exportModule.processContentTypes as jest.Mock).mock.calls[0].slice(0, 3)).toEqual([dir, [], types]);
    }

    it('should export all content types for the current hub if no schemaIds specified', async (): Promise<void> => {
      const schemaIdsToExport: string[] | undefined = undefined;
      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: schemaIdsToExport };

      const filteredContentTypesToExport = [...contentTypesToExport];
      jest.spyOn(exportModule, 'filterContentTypesByUri').mockReturnValue(filteredContentTypesToExport);

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalledTimes(1);
      expect(mockList).toHaveBeenCalledWith({ size: 100, status: 'ACTIVE' });
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentType);
      expect(validateNoDuplicateContentTypeUris).toHaveBeenCalled();
      expect(exportModule.filterContentTypesByUri).toHaveBeenCalledWith(contentTypesToExport, []);
      expectProcessArguments(argv.dir, filteredContentTypesToExport);
    });

    it('should export even archived content types for the current hub if --archived is provided', async (): Promise<
      void
    > => {
      const schemaIdsToExport: string[] | undefined = undefined;
      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: schemaIdsToExport, archived: true };

      const filteredContentTypesToExport = [...contentTypesToExport];
      jest.spyOn(exportModule, 'filterContentTypesByUri').mockReturnValue(filteredContentTypesToExport);

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalledTimes(2);
      expect(mockList).toHaveBeenCalledWith({ size: 100, status: 'ACTIVE' });
      expect(mockList).toHaveBeenCalledWith({ size: 100, status: 'ARCHIVED' });
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentType);
      expect(validateNoDuplicateContentTypeUris).toHaveBeenCalled();
      expect(exportModule.filterContentTypesByUri).toHaveBeenCalledWith(contentTypesToExport, []);
      expectProcessArguments(argv.dir, filteredContentTypesToExport);
    });

    it('should export only selected content types if schemaIds specified', async (): Promise<void> => {
      const schemaIdsToExport: string[] | undefined = ['content-type-uri-2'];
      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: schemaIdsToExport };

      const filteredContentTypesToExport = [contentTypesToExport[1]];
      jest.spyOn(exportModule, 'filterContentTypesByUri').mockReturnValue(filteredContentTypesToExport);

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalled();
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentType);
      expect(validateNoDuplicateContentTypeUris).toHaveBeenCalled();
      expect(exportModule.filterContentTypesByUri).toHaveBeenCalledWith(contentTypesToExport, schemaIdsToExport);
      expectProcessArguments(argv.dir, filteredContentTypesToExport);
    });
  });
});
