import { builder, command, processContentTypes, handler, getExportRecordForContentType } from './export';
import Yargs from 'yargs/yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import * as exportModule from './export';
import * as exportServiceModule from '../../services/export.service';
import { createStream } from 'table';
import chalk from 'chalk';
import { validateNoDuplicateContentTypeUris } from './import';
import { loadJsonFromDirectory } from '../../services/import.service';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('./import');
jest.mock('../../services/import.service');
jest.mock('table');

describe('content-type export command', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should implement an export command', () => {
    expect(command).toEqual('export <dir>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();
      const spyArray = jest.spyOn(argv, 'array').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Output directory for the exported Content Type definitions',
        type: 'string'
      });
      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        describe: 'content-type-schema ID(s) of Content Type(s) to export',
        requiresArg: true
      });
      expect(spyArray).toHaveBeenCalledWith('schemaId');
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

      expect(exportServiceModule.uniqueFilename).toHaveBeenCalledWith('export-dir', 'json');
      expect(result).toEqual({ filename: 'export-dir/export-filename-3.json', status: 'CREATED' });
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
      expect(result).toEqual({ filename: 'export-dir/export-filename-2.json', status: 'UPDATED' });
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
      const updatedContentTypeToExport = new ContentType({
        id: 'content-type-id-2',
        contentTypeUri: 'content-type-uri-2',
        settings: {
          label: 'content type 2'
        }
      });

      jest.spyOn(exportServiceModule, 'uniqueFilename');

      const result = getExportRecordForContentType(updatedContentTypeToExport, 'export-dir', exportedContentTypes);

      expect(exportServiceModule.uniqueFilename).toHaveBeenCalledTimes(0);
      expect(result).toEqual({ filename: 'export-dir/export-filename-2.json', status: 'UP-TO-DATE' });
    });
  });

  describe('processContentTypes', () => {
    const mockStreamWrite = jest.fn();

    beforeEach(() => {
      (createStream as jest.Mock).mockReturnValue({
        write: mockStreamWrite
      });
    });

    it('should output export files for all specified content types if nothing previously exported', async () => {
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

      jest.spyOn(exportServiceModule, 'writeJsonToFile').mockImplementation();

      jest
        .spyOn(exportModule, 'getExportRecordForContentType')
        .mockReturnValueOnce({ filename: 'export-dir/export-filename-1.json', status: 'CREATED' })
        .mockReturnValueOnce({ filename: 'export-dir/export-filename-2.json', status: 'CREATED' })
        .mockReturnValueOnce({ filename: 'export-dir/export-filename-3.json', status: 'CREATED' });

      await processContentTypes('export-dir', {}, contentTypesToProcess);

      expect(exportModule.getExportRecordForContentType).toHaveBeenCalledTimes(3);
      expect(exportModule.getExportRecordForContentType).toHaveBeenNthCalledWith(
        1,
        contentTypesToProcess[0],
        'export-dir',
        {}
      );
      expect(exportModule.getExportRecordForContentType).toHaveBeenNthCalledWith(
        2,
        contentTypesToProcess[1],
        'export-dir',
        {}
      );
      expect(exportModule.getExportRecordForContentType).toHaveBeenNthCalledWith(
        3,
        contentTypesToProcess[2],
        'export-dir',
        {}
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
        chalk.bold('file'),
        chalk.bold('contentTypeUri'),
        chalk.bold('result')
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

    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });

      mockGetHub.mockResolvedValue({
        related: {
          contentTypes: {
            list: jest.fn()
          }
        }
      });
    });

    it('should export all content types for the current hub', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir' };
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
      (loadJsonFromDirectory as jest.Mock).mockReturnValue([]);
      (validateNoDuplicateContentTypeUris as jest.Mock).mockImplementation();

      const listResponse = new MockPage(ContentType, contentTypesToExport);
      const mockList = jest.fn().mockResolvedValue(listResponse);

      const mockGetHub = jest.fn().mockResolvedValue({
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
      jest.spyOn(exportModule, 'processContentTypes').mockResolvedValueOnce();

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalled();
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentType);
      expect(validateNoDuplicateContentTypeUris).toHaveBeenCalled();
      expect(exportModule.processContentTypes).toHaveBeenCalledWith(argv.dir, [], contentTypesToExport);
    });
  });
});
