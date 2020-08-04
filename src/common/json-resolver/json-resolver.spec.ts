import nock from 'nock';
import fs from 'fs';
import { jsonResolver } from './json-resolver';
import path from 'path';

jest.mock('fs');
jest.mock('path');

describe('content type schema helper', function() {
  beforeEach((): void => {
    jest.resetAllMocks();
  });

  describe('Loading JSON from URL', () => {
    async function successfulAxiosGetInvocation(basePath: string, path: string): Promise<void> {
      const url = `${basePath}${path}`;
      const data = JSON.stringify(
        {
          $schema: 'test',
          $id: url
        },
        null,
        2
      );

      const scope = nock(basePath)
        .get(path)
        .reply(200, data);

      const response = await jsonResolver(url);

      expect(scope.isDone()).toBeTruthy();
      expect(response).toEqual(data);
    }

    it('should load JSON from a url (http) as object', async function() {
      await successfulAxiosGetInvocation('http://example.com', '/schema.json');
    });

    it('should load JSON from a url (https) as object', async function() {
      await successfulAxiosGetInvocation('https://example.com', '/schema.json');
    });
  });

  describe('Loading JSON from a local file', () => {
    async function successfulLocalFileInvocation(schema: string, relativePath: string = __dirname): Promise<void> {
      const mockFileRead = fs.readFileSync as jest.Mock;
      const mockExistsSync = fs.existsSync as jest.Mock;
      const mockSchemaData = {
        $schema: 'test',
        id: 'test'
      };
      mockFileRead.mockResolvedValue(JSON.stringify(mockSchemaData));
      mockExistsSync.mockResolvedValue(true);
      const response = await jsonResolver(schema, relativePath);
      expect(mockFileRead).toHaveBeenCalledTimes(1);
      expect(response).toEqual(JSON.stringify(mockSchemaData));
    }

    it('should load JSON from a local file (relative path) using __dirname as relative dir', async function() {
      const mockPathResolve = path.resolve as jest.Mock;
      await successfulLocalFileInvocation('./content-type-schema/schema.json');
      expect(mockPathResolve).toHaveBeenCalledWith(__dirname, './content-type-schema/schema.json');
    });

    it('should load JSON from a local file (relative path) using a supplied relative dir', async function() {
      const mockPathResolve = path.resolve as jest.Mock;
      await successfulLocalFileInvocation('./content-type-schema/schema.json', '/foo');
      expect(mockPathResolve).toHaveBeenCalledWith('/foo', './content-type-schema/schema.json');
    });

    it('should load JSON from a local file (with file url)', async function() {
      await successfulLocalFileInvocation('file://content-type-schema/schema.json');
    });
  });

  describe('Loading JSON from a escaped string', () => {
    const mockFileRead = fs.readFileSync as jest.Mock;
    const mockExistsSync = fs.existsSync as jest.Mock;

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should load valid JSON (Object as string passed in)', async function() {
      const json = { foo: 'bar', bar: 'baz' };
      const response = await jsonResolver(JSON.stringify(json));
      expect(mockFileRead).toHaveBeenCalledTimes(0);
      expect(response).toEqual(JSON.stringify(json));
    });

    it('should load valid JSON (Object as escaped string passed in)', async function() {
      const escapedjson = '{"foo":"bar","bar":"baz"}';
      const response = await jsonResolver(escapedjson);
      expect(mockFileRead).toHaveBeenCalledTimes(0);
      expect(response).toEqual(escapedjson);
    });

    it('should load valid JSON (Array passed in)', async function() {
      const json = [{ foo: 'bar', bar: 'baz' }];
      const response = await jsonResolver(JSON.stringify(json));
      expect(mockFileRead).toHaveBeenCalledTimes(0);
      expect(response).toEqual(JSON.stringify(json));
    });

    it('should fail to load invalid JSON and fall out at the end (null passed in)', async function() {
      mockExistsSync.mockReturnValue(false);

      await expect(jsonResolver('null', '/tmp')).rejects.toThrowErrorMatchingSnapshot();
      expect(mockFileRead).not.toHaveBeenCalled();
    });

    it('should fail to load invalid JSON and fall out at the end', async function() {
      mockExistsSync.mockReturnValue(false);

      await expect(jsonResolver('this is just a string', '/tmp')).rejects.toThrowErrorMatchingSnapshot();
      expect(mockFileRead).not.toHaveBeenCalled();
    });

    it('should fail to load invalid JSON and fall out at the end (undefined passing in)', async function() {
      mockExistsSync.mockReturnValue(false);

      await expect(jsonResolver(undefined, '/tmp')).rejects.toThrowErrorMatchingSnapshot();
      expect(mockFileRead).not.toHaveBeenCalled();
    });
  });
});
