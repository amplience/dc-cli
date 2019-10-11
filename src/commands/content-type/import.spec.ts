import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import DataPresenter, { RenderingOptions } from '../../view/data-presenter';
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
  const mockDataPresenter = DataPresenter as jest.Mock;

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
      const mockContentType = new ContentType(contentTypeFile);
      mockReadFile.mockReturnValue(JSON.stringify(contentTypeFile));
      const dirName = 'my-dir';
      const importObjects: ContentType[] = extractImportObjects<ContentType>(dirName, ContentType);
      expect(importObjects.map(o => o.toJSON())).toEqual([mockContentType.toJSON()]);
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
      expect(() => extractImportObjects<ContentType>(dirName, ContentType)).toThrowError(
        'Non-JSON file found: a.json, aborting import'
      );
      expect(mockFileReadDir).toHaveBeenCalledWith(dirName);
      expect(mockReadFile).toHaveBeenCalledTimes(1);
      expect(mockReadFile).toHaveBeenCalledWith(path.join(dirName, mockFileNames[0]), 'utf-8');
    });
  });

  describe.skip('handler tests', () => {
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

      const storedContentTypes = [
        {
          contentTypeUri: 'https://content-type-uri',
          settings: {
            label: 'content-type-label',
            icons: [{ size: 256, url: 'https://test-icon-url' }],
            visualizations: [{ label: 'viz-label', templatedUri: 'https://test-viz-url', default: true }],
            cards: [{ label: 'cards-label', templatedUri: 'https://test-cards-url', default: true }]
          }
        }
      ];
      const contentTypeResponse: ContentType[] = storedContentTypes.map(v => new ContentType(v));

      const listResponse = new MockPage(ContentType, contentTypeResponse);
      const mockList = jest.fn().mockResolvedValue(listResponse);
      const mockRegister = jest.fn().mockResolvedValue(contentTypeResponse);

      const mockGetHub = jest.fn().mockResolvedValue({
        related: {
          contentTypes: {
            list: mockList,
            register: mockRegister
          }
        }
      });

      const mockFileReadDir = fs.readdirSync as jest.Mock;
      const mockFileNames: string[] = ['a.json', 'b.json'];
      mockFileReadDir.mockReturnValue(mockFileNames);
      const mockReadFile = fs.readFileSync as jest.Mock;
      const mockContentType = {
        contentTypeUri: 'https://matching-content-type-uri',
        settings: {
          label: 'content-type-label',
          icons: [{ size: 256, url: 'https://test-icon-url' }],
          visualizations: [{ label: 'viz-label', templatedUri: 'https://test-viz-url', default: true }],
          cards: [{ label: 'cards-label', templatedUri: 'https://test-cards-url', default: true }]
        }
      };
      mockReadFile
        .mockReturnValueOnce(JSON.stringify(mockContentType))
        .mockReturnValueOnce(
          JSON.stringify({ ...mockContentType, contentTypeUri: 'https://not-matching-content-type-uri' })
        );

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });

      const argv = { ...yargArgs, ...config, dir: 'my-dir' };
      await handler(argv);

      expect(mockGetHub).toBeCalledWith('hub-id');
      expect(mockList).toBeCalledTimes(1);
    });
  });
});
