import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { RenderingOptions } from '../../view/data-presenter';
import { ContentType } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import fs from 'fs';
import { builder, command, extractImportObjects, handler } from './import';
import Yargs from 'yargs/yargs';
import path from 'path';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');
jest.mock('fs');

describe('content-type import command', (): void => {
  afterEach((): void => {
    jest.resetAllMocks();
  });

  it('should implement an import command', () => {
    expect(command).toEqual('import [dir]');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        demandOption: true,
        describe: 'Path to Content Type definitions',
        type: 'string'
      });
      expect(spyOptions).toHaveBeenCalledWith({
        ...RenderingOptions
      });
    });
  });

  describe('extractImportObjects tests', () => {
    it('should return a list of content types to import', (): void => {
      const mockFileReadDir = fs.readdirSync as jest.Mock;
      const mockFileNames: string[] = ['a.json'];
      mockFileReadDir.mockReturnValue(mockFileNames);
      const mockReadFile = fs.readFileSync as jest.Mock;
      const contentTypeFile = {
        id: 'content-type-id'
      };
      mockReadFile.mockReturnValue(JSON.stringify(contentTypeFile));
      const dirName = 'my-dir';
      const importObjects: ContentType[] = extractImportObjects<ContentType>(dirName);
      expect(importObjects).toEqual([contentTypeFile]);
      expect(mockFileReadDir).toHaveBeenCalledWith(dirName);
      expect(mockReadFile).toHaveBeenCalledTimes(1);
      expect(mockReadFile).toHaveBeenCalledWith(path.join(dirName, mockFileNames[0]), 'utf-8');
    });

    it('should throw an error if any import file is not json', (): void => {
      const mockFileReadDir = fs.readdirSync as jest.Mock;
      const mockFileNames: string[] = ['a.json', 'b.json'];
      mockFileReadDir.mockReturnValue(mockFileNames);
      const mockReadFile = fs.readFileSync as jest.Mock;
      const mockContentType = 'invalid json';
      mockReadFile.mockReturnValue(mockContentType);
      const dirName = 'my-dir';
      expect(() => extractImportObjects<ContentType>(dirName)).toThrowError(
        'Non-JSON file found: a.json, aborting import'
      );
      expect(mockFileReadDir).toHaveBeenCalledWith(dirName);
      expect(mockReadFile).toHaveBeenCalledTimes(1);
      expect(mockReadFile).toHaveBeenCalledWith(path.join(dirName, mockFileNames[0]), 'utf-8');
    });
  });

  describe('handler tests', () => {
    const mockGetContentType = jest.fn();
    const mockUpdate = jest.fn();
    const mockGetHub = jest.fn();
    const mockList = jest.fn();
    const mockRegister = jest.fn();
    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        },
        contentTypes: {
          get: mockGetContentType
        }
      });

      mockGetHub.mockResolvedValue({
        related: {
          contentTypes: {
            list: mockList,
            register: mockRegister
          }
        }
      });
    });

    it('should call the handler', async (): Promise<void> => {
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
      const mockFileReadDir = fs.readdirSync as jest.Mock;
      const mockFileNames: string[] = ['a.json', 'b.json'];

      mockFileReadDir.mockReturnValue(mockFileNames);

      const storedContentType = {
        id: 'stored-id',
        contentTypeUri: 'https://content-type-uri-a',
        settings: {
          label: 'content-type-label',
          icons: [{ size: 256, url: 'https://test-icon-url' }],
          visualizations: [{ label: 'viz-label', templatedUri: 'https://test-viz-url', default: true }],
          cards: [{ label: 'cards-label', templatedUri: 'https://test-cards-url', default: true }]
        }
      };
      const storedContentTypes = [storedContentType];
      const contentTypeResponse: ContentType[] = storedContentTypes.map(v => new ContentType(v));
      const listResponse = new MockPage(ContentType, contentTypeResponse);

      mockList.mockResolvedValue(listResponse);
      mockRegister.mockResolvedValue(contentTypeResponse);

      const mutatedContentType = {
        ...storedContentType,
        ...{ settings: { ...storedContentType.settings, ...{ label: 'mutated-content-type-label' } } }
      };
      const contentTypeToCreate = { ...storedContentType, contentTypeUri: 'https://not-matching-content-type-uri' };
      const mockReadFile = fs.readFileSync as jest.Mock;

      mockReadFile
        .mockReturnValueOnce(JSON.stringify(mutatedContentType))
        .mockReturnValueOnce(JSON.stringify(contentTypeToCreate));

      const contentTypeToUpdate = new ContentType(storedContentType);

      contentTypeToUpdate.related.update = mockUpdate;
      mockGetContentType.mockResolvedValue(contentTypeToUpdate);
      mockUpdate.mockResolvedValue(new ContentType(mutatedContentType));

      const argv = { ...yargArgs, ...config, dir: 'my-dir' };

      await handler(argv);

      expect(mockGetHub).toBeCalledWith('hub-id');
      expect(mockList).toBeCalledTimes(1);
      expect(mockRegister).toHaveBeenCalledTimes(1);
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining(contentTypeToCreate));
      expect(mockGetContentType).toHaveBeenCalledTimes(1);
      expect(mockGetContentType).toHaveBeenCalledWith('stored-id');
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType));
    });
  });
});
