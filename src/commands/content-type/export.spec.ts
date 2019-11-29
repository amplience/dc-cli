import {
  builder,
  command,
  processContentTypes,
  handler,
  getExportRecordForContentType,
  filterContentTypesByUri,
  promptToOverwriteExports,
  getExports
} from './export';
import Yargs from 'yargs/yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import * as exportModule from './export';
import * as exportServiceModule from '../../services/export.service';
import { createStream, table } from 'table';
import chalk from 'chalk';
import { validateNoDuplicateContentTypeUris } from './import';
import { loadJsonFromDirectory } from '../../services/import.service';
import * as readline from 'readline';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('./import');
jest.mock('../../services/import.service');
jest.mock('table');

const mockQuestion = jest.fn();
const mockClose = jest.fn();

jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: mockQuestion,
    close: mockClose
  }))
}));

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

      const [allExports, updatedExportsMap] = getExports('export-dir', {}, contentTypesToExport);

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

      const [allExports, updatedExportsMap] = getExports('export-dir', exportedContentTypes, contentTypesToExport);

      expect(getExportRecordForContentTypeSpy).toHaveBeenCalledTimes(2);
      expect(getExportRecordForContentTypeSpy.mock.calls).toMatchSnapshot();
      expect(allExports).toMatchSnapshot();
      expect(updatedExportsMap).toMatchSnapshot();
    });

    it('should not return a list of content-types to export or a list of filenames that will be updated', () => {
      const [allExports, updatedExportsMap] = getExports('export-dir', {}, []);

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

      const result = getExportRecordForContentType(newContentTypeToExport, 'export-dir', exportedContentTypes);

      expect(exportServiceModule.uniqueFilename).toHaveBeenCalledWith(
        'export-dir',
        newContentTypeToExport.contentTypeUri,
        'json',
        Object.keys(exportedContentTypes)
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
    it('should return the content types matching the given uris', async () => {
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

      const result = filterContentTypesByUri(listToFilter, ['content-type-uri-1', 'content-type-uri-3']);

      expect(result).toEqual(expect.arrayContaining([listToFilter[0], listToFilter[2]]));
    });

    it('should throw an error for uris which do not exist in the list of content types', async () => {
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

      expect(() =>
        filterContentTypesByUri(listToFilter, ['content-type-uri-1', 'content-type-uri-4', 'content-type-uri-3'])
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('processContentTypes', () => {
    let mockStreamWrite: jest.Mock;
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
      mockStreamWrite = jest.fn();
      (createStream as jest.Mock).mockReturnValue({
        write: mockStreamWrite
      });
      jest.spyOn(exportServiceModule, 'writeJsonToFile').mockImplementation();
      stdoutSpy = jest.spyOn(process.stdout, 'write');
      stdoutSpy.mockImplementation();
    });

    it('should output export files for the given content types if nothing previously exported', async () => {
      jest.spyOn(exportModule, 'getExports').mockReturnValueOnce([
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
      await processContentTypes('export-dir', previouslyExportedContentTypes, contentTypesToProcess);

      expect(exportModule.getExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedContentTypes,
        contentTypesToProcess
      );

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

      expect(mockStreamWrite).toHaveBeenCalledTimes(4);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(1, [
        chalk.bold('File'),
        chalk.bold('Schema ID'),
        chalk.bold('Result')
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(2, [
        'export-dir/export-filename-1.json',
        exportedContentTypes[0].contentTypeUri,
        'CREATED'
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(3, [
        'export-dir/export-filename-2.json',
        exportedContentTypes[1].contentTypeUri,
        'CREATED'
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(4, [
        'export-dir/export-filename-3.json',
        exportedContentTypes[2].contentTypeUri,
        'CREATED'
      ]);
    });

    it('should output a message if no content types to export from hub', async () => {
      jest.spyOn(exportModule, 'getExports').mockReturnValueOnce([[], []]);

      const previouslyExportedContentTypes = {};
      await processContentTypes('export-dir', previouslyExportedContentTypes, []);

      expect(exportModule.getExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getExports).toHaveBeenCalledWith('export-dir', previouslyExportedContentTypes, []);

      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(0);
      expect(mockStreamWrite).toHaveBeenCalledTimes(0);
    });

    it('should not output any export files if a previous export exists and the content type is unchanged', async () => {
      jest.spyOn(exportModule, 'getExports').mockReturnValueOnce([
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
      await processContentTypes('export-dir', previouslyExportedContentTypes, contentTypesToProcess);

      expect(exportModule.getExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedContentTypes,
        contentTypesToProcess
      );

      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(0);

      expect(mockStreamWrite).toHaveBeenCalledTimes(4);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(1, [
        chalk.bold('File'),
        chalk.bold('Schema ID'),
        chalk.bold('Result')
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(2, [
        'export-dir/export-filename-1.json',
        exportedContentTypes[0].contentTypeUri,
        'UP-TO-DATE'
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(3, [
        'export-dir/export-filename-2.json',
        exportedContentTypes[1].contentTypeUri,
        'UP-TO-DATE'
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(4, [
        'export-dir/export-filename-3.json',
        exportedContentTypes[2].contentTypeUri,
        'UP-TO-DATE'
      ]);
    });

    it('should update the existing export file for a changed content type', async () => {
      const mutatedContentTypes = [...contentTypesToProcess];
      mutatedContentTypes[1] = new ContentType({
        id: 'content-type-id-2',
        contentTypeUri: 'content-type-uri-2',
        settings: { label: 'content type 2 - mutated label' }
      });

      jest.spyOn(exportModule, 'promptToOverwriteExports').mockResolvedValueOnce(true);

      jest.spyOn(exportModule, 'getExports').mockReturnValueOnce([
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

      await processContentTypes('export-dir', previouslyExportedContentTypes, mutatedContentTypes);

      expect(exportModule.getExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedContentTypes,
        mutatedContentTypes
      );

      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(1);

      expect(mockStreamWrite).toHaveBeenCalledTimes(4);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(1, [
        chalk.bold('File'),
        chalk.bold('Schema ID'),
        chalk.bold('Result')
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(2, [
        'export-dir/export-filename-1.json',
        exportedContentTypes[0].contentTypeUri,
        'UP-TO-DATE'
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(3, [
        'export-dir/export-filename-2.json',
        exportedContentTypes[1].contentTypeUri,
        'UPDATED'
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(4, [
        'export-dir/export-filename-3.json',
        exportedContentTypes[2].contentTypeUri,
        'UP-TO-DATE'
      ]);
    });

    it('should not update anything if the user says "n" to the overwrite prompt', async () => {
      const mutatedContentTypes = [...contentTypesToProcess];
      mutatedContentTypes[1] = new ContentType({
        id: 'content-type-id-2',
        contentTypeUri: 'content-type-uri-2',
        settings: { label: 'content type 2 - mutated label' }
      });

      const exitError = new Error('ERROR TO VALIDATE PROCESS EXIT');
      jest.spyOn(process, 'exit').mockImplementation(() => {
        throw exitError;
      });
      jest.spyOn(exportModule, 'promptToOverwriteExports').mockResolvedValueOnce(false);
      jest.spyOn(exportModule, 'getExports').mockReturnValueOnce([
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

      await expect(
        processContentTypes('export-dir', previouslyExportedContentTypes, mutatedContentTypes)
      ).rejects.toThrowError(exitError);

      expect(exportModule.getExports).toHaveBeenCalledTimes(1);
      expect(exportModule.getExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedContentTypes,
        mutatedContentTypes
      );

      expect(exportServiceModule.writeJsonToFile).toHaveBeenCalledTimes(0);
      expect(mockStreamWrite).toHaveBeenCalledTimes(0);
      expect(process.exit).toHaveBeenCalled();
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

    it('should export all content types for the current hub if no schemaIds specified', async (): Promise<void> => {
      const schemaIdsToExport: string[] | undefined = undefined;
      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: schemaIdsToExport };

      const filteredContentTypesToExport = [...contentTypesToExport];
      jest.spyOn(exportModule, 'filterContentTypesByUri').mockReturnValue(filteredContentTypesToExport);

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalled();
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentType);
      expect(validateNoDuplicateContentTypeUris).toHaveBeenCalled();
      expect(exportModule.filterContentTypesByUri).toHaveBeenCalledWith(contentTypesToExport, []);
      expect(exportModule.processContentTypes).toHaveBeenCalledWith(argv.dir, [], filteredContentTypesToExport);
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
      expect(exportModule.processContentTypes).toHaveBeenCalledWith(argv.dir, [], filteredContentTypesToExport);
    });
  });

  describe('promptToOverwriteExports', () => {
    let createInterfaceSpy: jest.SpyInstance;
    let stdoutSpy: jest.SpyInstance;
    beforeEach(() => {
      createInterfaceSpy = jest.spyOn(readline, 'createInterface');
      stdoutSpy = jest.spyOn(process.stdout, 'write');
      stdoutSpy.mockImplementation();
    });

    afterEach(() => {
      createInterfaceSpy.mockClear();
      mockQuestion.mockClear();
      stdoutSpy.mockClear();
      mockClose.mockClear();
    });

    afterAll(() => {
      jest.resetAllMocks();
      jest.restoreAllMocks();
    });

    it('Should return true when the answer is "y"', async () => {
      mockQuestion.mockImplementation((question: string, cb: (answer: string) => Promise<boolean>) => {
        return cb('y');
      });

      const updatedExportsMap = [{ uri: 'my-content-type-uri', filename: 'my-export-filename' }];
      const res = await promptToOverwriteExports(updatedExportsMap);

      expect(res).toBeTruthy();
      expect(createInterfaceSpy).toHaveBeenCalledTimes(1);
      expect(mockQuestion).toHaveBeenCalledTimes(1);
      expect(mockQuestion.mock.calls).toMatchSnapshot();
      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect((table as jest.Mock).mock.calls).toMatchSnapshot();
    });

    it('Should return false when the answer is "n"', async () => {
      mockQuestion.mockImplementation((question: string, cb: (answer: string) => Promise<boolean>) => {
        return cb('n');
      });

      const updatedExportsMap = [{ uri: 'my-content-type-uri', filename: 'my-export-filename' }];
      const res = await promptToOverwriteExports(updatedExportsMap);

      expect(res).toBeFalsy();
      expect(createInterfaceSpy).toHaveBeenCalledTimes(1);
      expect(mockQuestion).toHaveBeenCalledTimes(1);
      expect(mockQuestion.mock.calls).toMatchSnapshot();
      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect((table as jest.Mock).mock.calls).toMatchSnapshot();
    });

    it('Should return false when the answer is anything but "y"', async () => {
      mockQuestion.mockImplementation((question: string, cb: (answer: string) => Promise<boolean>) => {
        return cb('');
      });

      const updatedExportsMap = [{ uri: 'my-content-type-uri', filename: 'my-export-filename' }];
      const res = await promptToOverwriteExports(updatedExportsMap);

      expect(res).toBeFalsy();
      expect(createInterfaceSpy).toHaveBeenCalledTimes(1);
      expect(mockQuestion).toHaveBeenCalledTimes(1);
      expect(mockQuestion.mock.calls).toMatchSnapshot();
      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect((table as jest.Mock).mock.calls).toMatchSnapshot();
    });
  });
});
