import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getJsonByPath } from './json-by-path';

jest.mock('axios');
jest.mock('fs');
jest.mock('path');

describe('content type schema helper', function() {
  beforeEach((): void => {
    jest.resetAllMocks();
  });

  async function successfulAxiosGetInvocation(protocol: string, schema: string, stringifyData: boolean): Promise<void> {
    const mockAxiosGet = axios.get as jest.Mock;
    const data = {
      $schema: 'test',
      id: 'test'
    };
    const mockSchemaResponse = {
      data: stringifyData ? JSON.stringify(data) : data
    };
    mockAxiosGet.mockResolvedValue(mockSchemaResponse);
    const response = await getJsonByPath(schema);
    expect(mockAxiosGet).toHaveBeenCalledWith(expect.stringMatching(protocol));
    expect(response).toEqual(JSON.stringify(data));
  }

  it('should load a schema from a url (http) as object', async function() {
    await successfulAxiosGetInvocation('http', 'http://example.com/schema.json', false);
  });

  it('should load a schema from a url (https) as object', async function() {
    await successfulAxiosGetInvocation('https', 'https://example.com/schema.json', false);
  });

  it('should load a schema from a url (http) as JSON string', async function() {
    await successfulAxiosGetInvocation('http', 'http://example.com/schema.json', true);
  });

  it('should load a schema from a url (https) as JSON string', async function() {
    await successfulAxiosGetInvocation('https', 'https://example.com/schema.json', true);
  });

  async function successfulLocalFileInvocation(schemaPath: string, relativePath: string = __dirname): Promise<void> {
    const mockFileRead = fs.readFileSync as jest.Mock;
    const mockExistsSync = fs.existsSync as jest.Mock;
    const mockSchemaData = {
      $schema: 'test',
      id: 'test'
    };
    mockFileRead.mockResolvedValue(JSON.stringify(mockSchemaData));
    mockExistsSync.mockResolvedValue(true);
    const response = await getJsonByPath(schemaPath, relativePath);
    expect(mockFileRead).toHaveBeenCalledTimes(1);
    expect(response).toEqual(JSON.stringify(mockSchemaData));
  }

  it('should load a schema from a local file (relative path) using __dirname as relative dir', async function() {
    const mockPathResolve = path.resolve as jest.Mock;
    await successfulLocalFileInvocation('./content-type-schema/schema.json');
    expect(mockPathResolve).toHaveBeenCalledWith(__dirname, './content-type-schema/schema.json');
  });

  it('should load a schema from a local file (relative path) using a supplied relative dir', async function() {
    const mockPathResolve = path.resolve as jest.Mock;
    await successfulLocalFileInvocation('./content-type-schema/schema.json', '/foo');
    expect(mockPathResolve).toHaveBeenCalledWith('/foo', './content-type-schema/schema.json');
  });

  it('should load a schema from a local file (with file url)', async function() {
    const mockPathResolve = path.resolve as jest.Mock;
    await successfulLocalFileInvocation('file://content-type-schema/schema.json');
    expect(mockPathResolve).not.toHaveBeenCalled();
  });

  it('should throw an error when file not found', async () => {
    const mockPathResolve = path.resolve as jest.Mock;
    const mockFileRead = fs.readFileSync as jest.Mock;
    const mockExistsSync = fs.existsSync as jest.Mock;
    mockExistsSync.mockReturnValue(false);

    await expect(getJsonByPath('./content-type-schema/schema.json', '/foo')).rejects.toThrowErrorMatchingSnapshot();

    expect(mockPathResolve).toHaveBeenCalledWith('/foo', './content-type-schema/schema.json');
    expect(mockExistsSync).toHaveBeenCalled();
    expect(mockFileRead).not.toHaveBeenCalled();
  });
});
