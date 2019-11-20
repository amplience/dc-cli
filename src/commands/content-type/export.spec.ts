import { builder, command, processContentTypes, handler } from './export';
import Yargs from 'yargs/yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType, Hub } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import * as exportModule from './export';
import * as exportServiceModule from '../../services/export.service';
import { createStream } from 'table';
import chalk from 'chalk';

jest.mock('../../services/dynamic-content-client-factory');
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

  describe('processContentTypes', () => {
    const mockStreamWrite = jest.fn();

    beforeEach(() => {
      (createStream as jest.Mock).mockReturnValue({
        write: mockStreamWrite
      });
    });

    it('should output export files for all specified content types', async () => {
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
      jest
        .spyOn(exportServiceModule, 'uniqueFilename')
        .mockReturnValueOnce('export-dir/export-filename-1.json')
        .mockReturnValueOnce('export-dir/export-filename-2.json')
        .mockReturnValueOnce('export-dir/export-filename-3.json');
      jest.spyOn(exportServiceModule, 'writeJsonToFile').mockImplementation();

      await processContentTypes('export-dir', contentTypesToProcess);

      expect(exportServiceModule.uniqueFilename).toHaveBeenCalledTimes(3);
      expect(exportServiceModule.uniqueFilename).toHaveBeenNthCalledWith(1, 'export-dir', 'json');
      expect(exportServiceModule.uniqueFilename).toHaveBeenNthCalledWith(2, 'export-dir', 'json');
      expect(exportServiceModule.uniqueFilename).toHaveBeenNthCalledWith(3, 'export-dir', 'json');

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
        'EXPORTED'
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(3, [
        'export-dir/export-filename-2.json',
        exportedContentTypes[1].contentTypeUri,
        'EXPORTED'
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(4, [
        'export-dir/export-filename-3.json',
        exportedContentTypes[2].contentTypeUri,
        'EXPORTED'
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
      expect(exportModule.processContentTypes).toHaveBeenCalledWith(argv.dir, contentTypesToExport);
    });
  });
});
