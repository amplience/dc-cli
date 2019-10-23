import Yargs = require('yargs/yargs');

import * as importModule from './import';
import {
  command,
  builder,
  handler,
  getSchemaList,
  storedSchemaMapper,
  processSchemas,
  doCreate,
  doUpdate,
  SchemaOptions
} from './import';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentTypeSchema, ValidationLevel, Hub } from 'dc-management-sdk-js';
import { createStream } from 'table';
import chalk from 'chalk';
import { getImportFileList, ImportFile } from '../../common/import/import-file-list';
import { getJsonByPath } from '../../common/import/json-by-path';
import { createContentTypeSchema } from './create.service';
import { updateContentTypeSchema } from './update.service';
import paginator from '../../common/dc-management-sdk-js/paginator';

jest.mock('fs');
jest.mock('table');
jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../common/import/import-file-list');
jest.mock('../../common/import/json-by-path');
jest.mock('../../common/dc-management-sdk-js/paginator');
jest.mock('./create.service');
jest.mock('./update.service');

describe('content-type-schema import command', (): void => {
  afterEach((): void => {
    jest.resetAllMocks();
  });

  it('should implement an import command', () => {
    expect(command).toEqual('import <manifest>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('manifest', {
        describe: 'Path to file referencing Content Type Schema definitions to be imported',
        type: 'string'
      });
    });
  });

  describe('getSchemaList', () => {
    it('should return a list of content type schemas', async () => {
      const schemaBody = { id: 'schema-id' };
      (getJsonByPath as jest.Mock).mockResolvedValueOnce(JSON.stringify(schemaBody));
      const schemaFileList = [{ uri: 'file-a.json', options: { validation: ValidationLevel.CONTENT_TYPE } }];
      const validationLevel = ValidationLevel.CONTENT_TYPE;
      const result = await getSchemaList(schemaFileList);

      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(expect.objectContaining({ body: JSON.stringify(schemaBody), validationLevel }));
    });

    it('should return an empty list when empty schema file list is passed', async () => {
      const result = await getSchemaList([]);

      expect(result).toEqual([]);
    });

    it('should throw and error when getting json fails', async () => {
      const schemaFileList = [{ uri: 'file-a.json', options: { validation: ValidationLevel.CONTENT_TYPE } }];
      (getJsonByPath as jest.Mock).mockRejectedValueOnce(new Error('Error retrieving json'));

      await expect(getSchemaList(schemaFileList)).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should throw an error when the manifest file does not contain valid details', async () => {
      const schemaFileList = [{ uri: 'file-a.json', options: {} }] as ImportFile<SchemaOptions>[];

      await expect(getSchemaList(schemaFileList)).rejects.toThrowErrorMatchingSnapshot();
    });
  });

  describe('storedSchemaMapper', () => {
    it('should map a stored schema to the imported list with matching imported schema', () => {
      const schemaBody = { id: 'schema-id' };
      const importedSchema = new ContentTypeSchema({
        body: JSON.stringify(schemaBody),
        validationLevel: ValidationLevel.CONTENT_TYPE
      });
      const storedContentTypeSchema = new ContentTypeSchema({ schemaId: schemaBody.id, ...importedSchema.toJSON() });
      const storedSchemaList = [storedContentTypeSchema];
      const validationLevel = ValidationLevel.CONTENT_TYPE;
      const result = storedSchemaMapper(importedSchema, storedSchemaList, validationLevel);

      expect(result).toEqual(expect.objectContaining(storedContentTypeSchema.toJSON()));
      expect(result.schemaId).toBeDefined();
    });

    it('should return the imported schema when there is no matching stored schema', () => {
      const schemaBody = { id: 'schema-id' };
      const importedSchema = new ContentTypeSchema({
        body: JSON.stringify(schemaBody),
        validationLevel: ValidationLevel.CONTENT_TYPE
      });
      const storedContentTypeSchema = new ContentTypeSchema({
        schemaId: 'stored-schema-id',
        ...importedSchema.toJSON()
      });
      const storedSchemaList = [storedContentTypeSchema];
      const validationLevel = ValidationLevel.CONTENT_TYPE;
      const result = storedSchemaMapper(importedSchema, storedSchemaList, validationLevel);

      expect(result).toEqual(expect.objectContaining(importedSchema.toJSON()));
      expect(result.schemaId).toBeUndefined();
    });

    it('should throw an exception if the schema body cannot be parsed', () => {
      const importedSchema = new ContentTypeSchema({
        body: 'invalid json',
        validationLevel: ValidationLevel.CONTENT_TYPE
      });
      const storedSchemaList: ContentTypeSchema[] = [];
      const validationLevel = ValidationLevel.CONTENT_TYPE;
      expect(() =>
        storedSchemaMapper(importedSchema, storedSchemaList, validationLevel)
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('doCreate', () => {
    it('should create a content type schema and report the results', async () => {
      const hub = new Hub();
      const schemaId = 'https://schema.localhost.com/test-1.json';
      const contentTypeSchema = {
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "${schemaId}",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      } as ContentTypeSchema;
      (createContentTypeSchema as jest.Mock).mockResolvedValueOnce({ ...contentTypeSchema, id: 'create-id', schemaId });
      const result = await doCreate(hub, contentTypeSchema);

      expect(createContentTypeSchema).toHaveBeenCalledWith(
        contentTypeSchema.body,
        contentTypeSchema.validationLevel,
        hub
      );
      expect(result).toEqual(['create-id', 'https://schema.localhost.com/test-1.json', 'CREATE', 'SUCCESS']);
    });

    it('should throw an error when content type schema fails to create', async () => {
      const hub = new Hub();
      const schemaId = 'https://schema.localhost.com/test-1.json';
      const contentTypeSchema = {
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "${schemaId}",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      } as ContentTypeSchema;
      (createContentTypeSchema as jest.Mock).mockImplementation(() => {
        throw new Error('Error creating content type schema');
      });

      await expect(doCreate(hub, contentTypeSchema)).rejects.toThrowErrorMatchingSnapshot();
    });
  });

  describe('doUpdate', () => {
    const mockGetContentTypeSchema = jest.fn();

    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentTypeSchemas: {
          get: mockGetContentTypeSchema
        }
      });
    });
    it('should update a content type schema and report the results', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const schemaId = 'https://schema.localhost.com/test-1.json';
      const storedContentTypeSchema = {
        id: 'stored-id',
        schemaId,
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "${schemaId}",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      } as ContentTypeSchema;
      const mutatedContentTypeSchema = {
        ...storedContentTypeSchema,
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "${schemaId}",\n\n\t"title": "Test Schema 1 - updated",\n\t"description": "Test Schema 1- updated",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`
      } as ContentTypeSchema;
      mockGetContentTypeSchema.mockResolvedValueOnce(new ContentTypeSchema(storedContentTypeSchema));
      (updateContentTypeSchema as jest.Mock).mockResolvedValueOnce({
        ...mutatedContentTypeSchema,
        id: 'stored-id',
        schemaId
      });
      const result = await doUpdate(client, mutatedContentTypeSchema);

      expect(updateContentTypeSchema).toHaveBeenCalledWith(
        expect.objectContaining(storedContentTypeSchema),
        mutatedContentTypeSchema.body,
        mutatedContentTypeSchema.validationLevel
      );
      expect(result).toEqual(['stored-id', 'https://schema.localhost.com/test-1.json', 'UPDATE', 'SUCCESS']);
    });

    it('should update a content type schema and report the results', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const schemaId = 'https://schema.localhost.com/test-1.json';
      const storedContentTypeSchema = {
        id: 'stored-id',
        schemaId,
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "${schemaId}",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      } as ContentTypeSchema;
      const mutatedContentTypeSchema = {
        ...storedContentTypeSchema,
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "${schemaId}",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`
      } as ContentTypeSchema;
      mockGetContentTypeSchema.mockResolvedValueOnce(new ContentTypeSchema(storedContentTypeSchema));

      const result = await doUpdate(client, mutatedContentTypeSchema);

      expect(updateContentTypeSchema).toHaveBeenCalledTimes(0);
      expect(result).toEqual(['stored-id', 'https://schema.localhost.com/test-1.json', 'UPDATE', 'SKIPPED']);
    });

    it('should throw an error when content type schema fails to create', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const schemaId = 'https://schema.localhost.com/test-1.json';
      const contentTypeSchema = {
        id: 'stored-id',
        schemaId,
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "${schemaId}",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      } as ContentTypeSchema;
      mockGetContentTypeSchema.mockImplementationOnce(() => {
        throw new Error('Error getting content type schema');
      });
      await expect(doUpdate(client, contentTypeSchema)).rejects.toThrowErrorMatchingSnapshot();
    });
  });

  describe('processSchemas', () => {
    const mockStreamWrite = jest.fn();
    const mockGetContentTypeSchema = jest.fn();

    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentTypeSchemas: {
          get: mockGetContentTypeSchema
        }
      });
      (createStream as jest.Mock).mockReturnValue({
        write: mockStreamWrite
      });
    });

    it('should successfully create and update a schema', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const hub = new Hub();
      const schemaId = 'https://schema.localhost.com/test-1.json';
      const contentTypeSchemaToCreate = {
        schemaId,
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "${schemaId}",\n\n\t"title": "Test Schema - Updated",\n\t"description": "Test Schema - Updated",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      } as ContentTypeSchema;
      const contentTypeSchemaToUpdate = { ...contentTypeSchemaToCreate, id: 'stored-id' } as ContentTypeSchema;
      const schemasToProcess = [contentTypeSchemaToCreate, contentTypeSchemaToUpdate];

      jest.spyOn(importModule, 'doCreate').mockResolvedValueOnce(['stored-id', schemaId, 'CREATE', 'SUCCESS']);
      jest.spyOn(importModule, 'doUpdate').mockResolvedValueOnce(['stored-id', schemaId, 'UPDATE', 'SUCCESS']);

      await processSchemas(schemasToProcess, client, hub);

      expect(mockStreamWrite).toHaveBeenCalledTimes(3);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(1, [
        chalk.bold('id'),
        chalk.bold('schemaId'),
        chalk.bold('method'),
        chalk.bold('status')
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(2, ['stored-id', schemaId, 'CREATE', 'SUCCESS']);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(3, ['stored-id', schemaId, 'UPDATE', 'SUCCESS']);
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
    const mockGetHub = jest.fn();

    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });
    });

    it('should process schemas from a remote and local locations', async (): Promise<void> => {
      const argv = {
        ...yargArgs,
        ...config,
        manifest: 'my-schema-list'
      };
      const remoteContentTypeSchema = {
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-1.json",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      };
      const localContentTypeSchema = {
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/local-test-2.json",\n\n\t"title": "Test Schema 2",\n\t"description": "Test Schema 2",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      };

      mockGetHub.mockResolvedValue(new Hub());
      (getImportFileList as jest.Mock).mockReturnValueOnce([
        { uri: 'https://example.com/test-schema-uri', options: { validation: ValidationLevel.CONTENT_TYPE } },
        { uri: 'file://example_schema.json', options: { validation: ValidationLevel.CONTENT_TYPE } }
      ]);

      jest
        .spyOn(importModule, 'getSchemaList')
        .mockResolvedValue([
          new ContentTypeSchema(remoteContentTypeSchema),
          new ContentTypeSchema(localContentTypeSchema)
        ]);

      (paginator as jest.Mock).mockResolvedValue([]);

      const processSchemasSpy = jest
        .spyOn(importModule, 'processSchemas')
        .mockImplementation(async (): Promise<void> => {});

      await handler(argv);
      expect(getImportFileList).toHaveBeenCalledWith('my-schema-list');
      expect(getSchemaList).toHaveBeenCalledWith([
        { uri: 'https://example.com/test-schema-uri', options: { validation: ValidationLevel.CONTENT_TYPE } },
        { uri: 'file://example_schema.json', options: { validation: ValidationLevel.CONTENT_TYPE } }
      ]);
      expect(paginator).toHaveBeenCalledWith(expect.any(Function));

      expect(processSchemasSpy).toHaveBeenCalledWith(
        [expect.objectContaining(remoteContentTypeSchema), expect.objectContaining(localContentTypeSchema)],
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
});
