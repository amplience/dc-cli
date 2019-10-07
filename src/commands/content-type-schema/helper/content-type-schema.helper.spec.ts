import axios from 'axios';
import fs from 'fs';
import { getSchemaBody } from './content-type-schema.helper';

jest.mock('axios');
jest.mock('fs');

describe('content type schema helper', function() {
  beforeEach((): void => {
    jest.resetAllMocks();
  });

  async function successfulAxiosGetInvocation(protocol: string, schema: string): Promise<void> {
    const mockAxiosGet = axios.get as jest.Mock;
    const mockSchemaResponse = {
      data: {
        $schema: 'test',
        id: 'test'
      }
    };
    mockAxiosGet.mockResolvedValue(mockSchemaResponse);
    const response = await getSchemaBody(schema);
    expect(mockAxiosGet).toHaveBeenCalledWith(expect.stringMatching(protocol));
    expect(response).toEqual(JSON.stringify(mockSchemaResponse.data));
  }

  it('should load a schema from a url (http)', async function() {
    await successfulAxiosGetInvocation('http', 'http://example.com/schema.json');
  });

  it('should load a schema from a url (https)', async function() {
    await successfulAxiosGetInvocation('https', 'https://example.com/schema.json');
  });

  async function successfulLocalFileInvocation(schema: string): Promise<void> {
    const mockFileRead = fs.readFileSync as jest.Mock;
    const mockSchemaData = {
      $schema: 'test',
      id: 'test'
    };
    mockFileRead.mockResolvedValue(JSON.stringify(mockSchemaData));
    const response = await getSchemaBody(schema);
    expect(mockFileRead).toHaveBeenCalledTimes(1);
    expect(response).toEqual(JSON.stringify(mockSchemaData));
  }

  it('should load a schema from a local file (relative path)', async function() {
    await successfulLocalFileInvocation('./content-type-schema/schema.json');
  });

  it('should load a schema from a local file (with file url)', async function() {
    await successfulLocalFileInvocation('file://content-type-schema/schema.json');
  });
});