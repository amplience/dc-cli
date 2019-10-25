import axios from 'axios';
import fs from 'fs';
import { jsonResolver } from './json-resolver';

jest.mock('axios');
jest.mock('fs');

describe('content type schema helper', function() {
  beforeEach((): void => {
    jest.resetAllMocks();
  });

  describe('Loading JSON from URL', () => {
    async function successfulAxiosGetInvocation(
      protocol: string,
      schema: string,
      stringifyData: boolean
    ): Promise<void> {
      const mockAxiosGet = axios.get as jest.Mock;
      const data = {
        $schema: 'test',
        id: 'test'
      };
      const mockSchemaResponse = {
        data: stringifyData ? JSON.stringify(data) : data
      };
      mockAxiosGet.mockResolvedValue(mockSchemaResponse);
      const response = await jsonResolver(schema);
      expect(mockAxiosGet).toHaveBeenCalledWith(expect.stringMatching(protocol));
      expect(response).toEqual(JSON.stringify(data));
    }

    it('should load JSON from a url (http) as object', async function() {
      await successfulAxiosGetInvocation('http', 'http://example.com/schema.json', false);
    });

    it('should load JSON from a url (https) as object', async function() {
      await successfulAxiosGetInvocation('https', 'https://example.com/schema.json', false);
    });

    it('should load JSON from a url (http) as JSON string', async function() {
      await successfulAxiosGetInvocation('http', 'http://example.com/schema.json', true);
    });

    it('should load JSON from a url (https) as JSON string', async function() {
      await successfulAxiosGetInvocation('https', 'https://example.com/schema.json', true);
    });
  });

  describe('Loading JSON from a local file', () => {
    async function successfulLocalFileInvocation(schema: string): Promise<void> {
      const mockFileRead = fs.readFileSync as jest.Mock;
      const mockSchemaData = {
        $schema: 'test',
        id: 'test'
      };
      mockFileRead.mockResolvedValue(JSON.stringify(mockSchemaData));
      const response = await jsonResolver(schema);
      expect(mockFileRead).toHaveBeenCalledTimes(1);
      expect(response).toEqual(JSON.stringify(mockSchemaData));
    }

    it('should load JSON from a local file (relative path)', async function() {
      await successfulLocalFileInvocation('./content-type-schema/schema.json');
    });

    it('should load JSON from a local file (with file url)', async function() {
      await successfulLocalFileInvocation('file://content-type-schema/schema.json');
    });
  });

  describe('Loading JSON from a escaped string', () => {
    const mockAxiosGet = axios.get as jest.Mock;
    const mockFileRead = fs.readFileSync as jest.Mock;

    it('should load valid JSON (Object passed in)', async function() {
      const json = { foo: 'bar', bar: 'baz' };
      const response = await jsonResolver(JSON.stringify(json));
      expect(mockAxiosGet).toHaveBeenCalledTimes(0);
      expect(mockFileRead).toHaveBeenCalledTimes(0);
      expect(response).toEqual(json);
    });

    it('should load valid JSON (Array passed in)', async function() {
      const json = [{ foo: 'bar', bar: 'baz' }];
      const response = await jsonResolver(JSON.stringify(json));
      expect(mockAxiosGet).toHaveBeenCalledTimes(0);
      expect(mockFileRead).toHaveBeenCalledTimes(0);
      expect(response).toEqual(json);
    });

    it('should fail to load invalid JSON and fall out at the end', async function() {
      mockAxiosGet.mockRejectedValue(new Error('Unresolved location'));
      mockFileRead.mockRejectedValue(new Error('ENOTFOUND'));

      expect(jsonResolver('this is just a string')).rejects.toThrowError(new Error('ENOTFOUND'));
      expect(mockFileRead).toHaveBeenCalledTimes(1);
    });
  });
});
