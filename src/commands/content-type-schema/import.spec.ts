import Yargs = require('yargs/yargs');

import * as importModule from './import';
import {
  command,
  builder,
  handler,
  storedSchemaMapper,
  processSchemas,
  doCreate,
  doUpdate,
  resolveSchemaBody
} from './import';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentTypeSchema, ValidationLevel, Hub } from 'dc-management-sdk-js';
import { createStream } from 'table';
import { createContentTypeSchema } from './create.service';
import { updateContentTypeSchema } from './update.service';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { loadJsonFromDirectory, UpdateStatus } from '../../services/import.service';
import { jsonResolver } from '../../common/import/json-resolver';

jest.mock('fs');
jest.mock('table');
jest.mock('../../common/dc-management-sdk-js/paginator');
jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../services/import.service');
jest.mock('./create.service');
jest.mock('./update.service');
jest.mock('../../common/import/json-resolver');

describe('content-type-schema import command', (): void => {
  afterEach((): void => {
    jest.resetAllMocks();
  });

  it('should implement an import command', () => {
    expect(command).toEqual('import <dir>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Directory containing Content Type Schema definitions',
        type: 'string'
      });
    });
  });

  describe('storedSchemaMapper', () => {
    it('should map a stored schema to the imported list with matching imported schema', () => {
      const schemaBody = { id: 'schema-id' };
      const importedSchema = new ContentTypeSchema({
        body: JSON.stringify(schemaBody),
        validationLevel: ValidationLevel.CONTENT_TYPE,
        schemaId: schemaBody.id
      });
      const storedContentTypeSchema = new ContentTypeSchema({
        id: 'stored-id',
        schemaId: schemaBody.id,
        ...importedSchema.toJSON()
      });
      const storedSchemaList = [storedContentTypeSchema];
      const result = storedSchemaMapper(importedSchema, storedSchemaList);

      expect(result).toEqual(expect.objectContaining(storedContentTypeSchema.toJSON()));
      expect(result.id).toBeDefined();
    });

    it('should return the imported schema when there is no matching stored schema', () => {
      const schemaBody = { id: 'schema-id' };
      const importedSchema = new ContentTypeSchema({
        body: JSON.stringify(schemaBody),
        validationLevel: ValidationLevel.CONTENT_TYPE,
        schemaId: schemaBody.id
      });
      const storedContentTypeSchema = new ContentTypeSchema({
        schemaId: 'stored-schema-id',
        ...importedSchema.toJSON()
      });
      const storedSchemaList = [storedContentTypeSchema];
      const result = storedSchemaMapper(importedSchema, storedSchemaList);

      expect(result).toEqual(expect.objectContaining(importedSchema.toJSON()));
      expect(result.id).toBeUndefined();
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
      expect(result).toEqual({ ...contentTypeSchema, id: 'create-id', schemaId });
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
      expect(result).toEqual({ contentTypeSchema: mutatedContentTypeSchema, updateStatus: UpdateStatus.UPDATED });
    });

    it('should skip updating a content type schema when no changes detected and report the results', async () => {
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
      expect(result).toEqual(expect.objectContaining({ updateStatus: UpdateStatus.SKIPPED }));
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

    beforeEach(() => {
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

      jest
        .spyOn(importModule, 'doCreate')
        .mockResolvedValueOnce({ ...contentTypeSchemaToCreate, id: 'new-id' } as ContentTypeSchema);
      jest
        .spyOn(importModule, 'doUpdate')
        .mockResolvedValueOnce({ contentTypeSchema: contentTypeSchemaToUpdate, updateStatus: UpdateStatus.UPDATED });

      await processSchemas(schemasToProcess, client, hub);

      expect(importModule.doCreate).toHaveBeenCalledWith(hub, contentTypeSchemaToCreate);
      expect(importModule.doUpdate).toHaveBeenCalledWith(client, contentTypeSchemaToUpdate);
      expect(mockStreamWrite).toHaveBeenCalledTimes(3);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(2, ['new-id', schemaId, 'CREATED']);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(3, ['stored-id', schemaId, 'UPDATED']);
    });
  });

  describe('resolveSchemaBody', () => {
    it('should allow undefined body', async () => {
      const result = await resolveSchemaBody([new ContentTypeSchema()], __dirname);
      expect(result).toHaveLength(1);
      expect(result[0].body).toBe(undefined);
    });
    it('should resolve body as string', async () => {
      const stringifiedBody = JSON.stringify('{"prop": 123}');
      const mockJsonResolver = jsonResolver as jest.Mock;
      mockJsonResolver.mockResolvedValueOnce(stringifiedBody);
      const result = await resolveSchemaBody([new ContentTypeSchema({ body: stringifiedBody })], __dirname);

      expect(result).toHaveLength(1);
      expect(result[0].body).toEqual(stringifiedBody);
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
    });

    it('should process schemas from a local directory', async (): Promise<void> => {
      const argv = {
        ...yargArgs,
        ...config,
        dir: 'my-dir'
      };
      const schemaToCreate = {
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-1.json",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE,
        schemaId: 'create-schema-id'
      };
      const schemaToUpdate = {
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/local-test-2.json",\n\n\t"title": "Test Schema 2",\n\t"description": "Test Schema 2",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE,
        schemaId: 'update-schema-id'
      };

      mockGetHub.mockResolvedValue(new Hub());
      (loadJsonFromDirectory as jest.Mock).mockReturnValueOnce([schemaToCreate, schemaToUpdate]);
      (paginator as jest.Mock).mockResolvedValue([{ ...schemaToUpdate, id: 'stored-id' }]);

      const processSchemasSpy = jest
        .spyOn(importModule, 'processSchemas')
        .mockImplementation(async (): Promise<void> => {});

      await handler(argv);

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('my-dir', ContentTypeSchema);
      expect(paginator).toHaveBeenCalledWith(expect.any(Function));
      expect(processSchemasSpy).toHaveBeenCalledWith(
        [expect.objectContaining(schemaToCreate), expect.objectContaining({ ...schemaToUpdate, id: 'stored-id' })],
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
});
