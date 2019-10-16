import Yargs = require('yargs/yargs');
import fs from 'fs';
import { command, builder, handler } from './import';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import { createStream } from 'table';
import chalk from 'chalk';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('fs');
jest.mock('table');

describe('content-type-schema import command', (): void => {
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

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        demandOption: true,
        describe: 'Path to Content Type Schema definitions',
        type: 'string'
      });
    });
  });

  describe('handler tests', () => {
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
    const mockReadFile = fs.readFileSync as jest.Mock;
    const mockGetHub = jest.fn();
    const mockList = jest.fn();
    const mockGetContentTypeSchema = jest.fn();
    const mockCreate = jest.fn();
    const mockUpdate = jest.fn();
    const mockStreamWrite = jest.fn();

    const storedContentTypeSchema = {
      validationLevel: 'CONTENT_TYPE',
      body:
        '{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/bp-test-1.json",\n\n\t"title": "Test Schema",\n\t"description": "Test Schema",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}',
      schemaId: 'https://schema.localhost.com/test-1.json',
      id: 'stored-id'
    };

    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        },
        contentTypeSchemas: {
          get: mockGetContentTypeSchema
        }
      });

      mockGetHub.mockResolvedValue({
        related: {
          contentTypeSchema: {
            create: mockCreate,
            update: mockUpdate,
            list: mockList
          }
        }
      });
      const storedContentTypeSchemas = [storedContentTypeSchema];
      const contentTypeSchemasResponse: ContentTypeSchema[] = storedContentTypeSchemas.map(
        v => new ContentTypeSchema(v)
      );
      const listResponse = new MockPage(ContentTypeSchema, contentTypeSchemasResponse);

      mockList.mockResolvedValue(listResponse);

      (createStream as jest.Mock).mockReturnValue({
        write: mockStreamWrite
      });
    });

    it('should create a content schema and update a content schema from a directory', async () => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir' };
      const mockFileNames: string[] = ['a.json', 'b.json'];

      mockFileReadDir.mockReturnValue(mockFileNames);

      const schemaToUpdate = new ContentTypeSchema({
        ...storedContentTypeSchema,
        body:
          '{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/bp-test-1.json",\n\n\t"title": "Test Schema - Updated",\n\t"description": "Test Schema - Updated",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}'
      });
      const schemaToCreate = { ...storedContentTypeSchema, schemaId: 'https://schema.localhost.com/new-test-1.json' };
      delete schemaToCreate.id;

      mockReadFile
        .mockReturnValueOnce(JSON.stringify(schemaToUpdate.toJSON()))
        .mockReturnValueOnce(JSON.stringify(schemaToCreate));

      const storedSchema = new ContentTypeSchema(storedContentTypeSchema);

      mockUpdate.mockResolvedValue(schemaToUpdate);
      storedSchema.related.update = mockUpdate;
      mockGetContentTypeSchema.mockResolvedValue(storedSchema);
      mockCreate.mockResolvedValue(new ContentTypeSchema(schemaToCreate));

      await handler(argv);

      expect(mockGetHub).toBeCalledWith('hub-id');
      expect(mockList).toBeCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining(schemaToCreate));
      expect(mockGetContentTypeSchema).toHaveBeenCalledTimes(1);
      expect(mockGetContentTypeSchema).toHaveBeenCalledWith('stored-id');
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(schemaToUpdate.toJSON()));
      expect(mockStreamWrite).toHaveBeenNthCalledWith(1, [
        chalk.bold('id'),
        chalk.bold('schemaId'),
        chalk.bold('method'),
        chalk.bold('status')
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(2, [
        'stored-id',
        'https://schema.localhost.com/test-1.json',
        'UPDATE',
        'SUCCESS'
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(3, [
        '',
        'https://schema.localhost.com/new-test-1.json',
        'CREATE',
        'SUCCESS'
      ]);
    });
  });
});
