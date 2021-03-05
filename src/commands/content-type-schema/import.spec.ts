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
  LOG_FILENAME
} from './import';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentTypeSchema, ValidationLevel, Hub } from 'dc-management-sdk-js';
import { table } from 'table';
import { createContentTypeSchema } from './create.service';
import { updateContentTypeSchema } from './update.service';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { loadJsonFromDirectory, UpdateStatus } from '../../services/import.service';
import { resolveSchemaBody } from '../../services/resolve-schema-body';
import { FileLog } from '../../common/file-log';
import { streamTableOptions } from '../../common/table/table.consts';
import chalk from 'chalk';

jest.mock('fs');
jest.mock('table');
jest.mock('../../common/dc-management-sdk-js/paginator');
jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../services/import.service');
jest.mock('../../services/resolve-schema-body');
jest.mock('./create.service');
jest.mock('./update.service');

const schemaId = 'https://schema.localhost.com/test-1.json';
const schemaBodyJson =
  '{\n\t"$schema": "http://json-schema.org/draft-07/schema#",\n\t"$id": "https://schema.localhost.com/test-1.json",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}';

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
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();
      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Directory containing Content Type Schema definitions',
        type: 'string'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.'
      });
    });
  });

  describe('storedSchemaMapper', () => {
    it('should map a stored schema to the imported list with matching imported schema', () => {
      const schemaBody = { $id: 'schema-id' };
      const importedSchema = new ContentTypeSchema({
        body: JSON.stringify(schemaBody),
        validationLevel: ValidationLevel.CONTENT_TYPE,
        schemaId: schemaBody.$id
      });
      const storedContentTypeSchema = new ContentTypeSchema({
        id: 'stored-id',
        schemaId: schemaBody.$id,
        ...importedSchema.toJSON()
      });
      const storedSchemaList = [storedContentTypeSchema];
      const result = storedSchemaMapper(importedSchema, storedSchemaList);

      expect(result).toEqual(expect.objectContaining(storedContentTypeSchema.toJSON()));
      expect(result.id).toBeDefined();
    });

    it('should return the imported schema when there is no matching stored schema', () => {
      const schemaBody = { $id: 'schema-id' };
      const importedSchema = new ContentTypeSchema({
        body: JSON.stringify(schemaBody),
        validationLevel: ValidationLevel.CONTENT_TYPE,
        schemaId: schemaBody.$id
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
      const log = new FileLog();

      const contentTypeSchema = {
        body: schemaBodyJson,
        validationLevel: ValidationLevel.CONTENT_TYPE
      } as ContentTypeSchema;
      (createContentTypeSchema as jest.Mock).mockResolvedValueOnce({ ...contentTypeSchema, id: 'create-id', schemaId });
      const result = await doCreate(hub, contentTypeSchema, log);

      expect(createContentTypeSchema).toHaveBeenCalledWith(
        contentTypeSchema.body,
        contentTypeSchema.validationLevel,
        hub
      );
      expect(result).toEqual({ ...contentTypeSchema, id: 'create-id', schemaId });
      expect(log.getData('CREATE')).toMatchInlineSnapshot(`
        Array [
          "create-id",
        ]
      `);
    });

    it('should throw an error when content type schema fails to create', async () => {
      const hub = new Hub();
      const log = new FileLog();

      const contentTypeSchema = {
        body: schemaBodyJson,
        validationLevel: ValidationLevel.CONTENT_TYPE
      } as ContentTypeSchema;
      (createContentTypeSchema as jest.Mock).mockImplementation(() => {
        throw new Error('Error creating content type schema');
      });

      await expect(doCreate(hub, contentTypeSchema, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('CREATE')).toEqual([]);
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
      const log = new FileLog();

      const storedContentTypeSchema = {
        id: 'stored-id',
        schemaId,
        body: schemaBodyJson,
        validationLevel: ValidationLevel.CONTENT_TYPE,
        version: 1
      } as ContentTypeSchema;
      const mutatedContentTypeSchema = {
        ...storedContentTypeSchema,
        body: `{\n\t"$schema": "http://json-schema.org/draft-07/schema#",\n\t"$id": "${schemaId}",\n\n\t"title": "Test Schema 1 - updated",\n\t"description": "Test Schema 1- updated",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        version: 2
      } as ContentTypeSchema;
      mockGetContentTypeSchema.mockResolvedValueOnce(new ContentTypeSchema(storedContentTypeSchema));
      (updateContentTypeSchema as jest.Mock).mockResolvedValueOnce({
        ...mutatedContentTypeSchema,
        id: 'stored-id',
        schemaId
      });
      const result = await doUpdate(client, mutatedContentTypeSchema, log);

      expect(log.getData('UPDATE')).toMatchInlineSnapshot(`
        Array [
          "stored-id 1 2",
        ]
      `);

      expect(updateContentTypeSchema).toHaveBeenCalledWith(
        expect.objectContaining(storedContentTypeSchema),
        mutatedContentTypeSchema.body,
        mutatedContentTypeSchema.validationLevel
      );
      expect(result).toEqual({ contentTypeSchema: mutatedContentTypeSchema, updateStatus: UpdateStatus.UPDATED });
    });

    it('should update a content type when only the validationLevel has been updated', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const log = new FileLog();
      const storedContentTypeSchema = {
        id: 'stored-id',
        schemaId,
        body: schemaBodyJson,
        validationLevel: ValidationLevel.CONTENT_TYPE,
        version: 1
      } as ContentTypeSchema;
      const mutatedContentTypeSchema = {
        ...storedContentTypeSchema,
        validationLevel: ValidationLevel.SLOT,
        version: 2
      } as ContentTypeSchema;
      mockGetContentTypeSchema.mockResolvedValueOnce(new ContentTypeSchema(storedContentTypeSchema));
      (updateContentTypeSchema as jest.Mock).mockResolvedValueOnce({
        ...mutatedContentTypeSchema,
        id: 'stored-id',
        schemaId
      });
      const result = await doUpdate(client, mutatedContentTypeSchema, log);

      expect(log.getData('UPDATE')).toMatchInlineSnapshot(`
        Array [
          "stored-id 1 2",
        ]
      `);
      expect(updateContentTypeSchema).toHaveBeenCalledWith(
        expect.objectContaining(storedContentTypeSchema),
        mutatedContentTypeSchema.body,
        mutatedContentTypeSchema.validationLevel
      );
      expect(result).toEqual({ contentTypeSchema: mutatedContentTypeSchema, updateStatus: UpdateStatus.UPDATED });
    });

    it('should skip updating a content type schema when no changes detected and report the results', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const log = new FileLog();

      const storedContentTypeSchema = {
        id: 'stored-id',
        schemaId,
        body: schemaBodyJson,
        validationLevel: ValidationLevel.CONTENT_TYPE
      } as ContentTypeSchema;
      const mutatedContentTypeSchema = {
        ...storedContentTypeSchema,
        body: schemaBodyJson
      } as ContentTypeSchema;
      mockGetContentTypeSchema.mockResolvedValueOnce(new ContentTypeSchema(storedContentTypeSchema));

      const result = await doUpdate(client, mutatedContentTypeSchema, log);

      expect(log.getData('UPDATE')).toEqual([]);
      expect(updateContentTypeSchema).toHaveBeenCalledTimes(0);
      expect(result).toEqual(expect.objectContaining({ updateStatus: UpdateStatus.SKIPPED }));
    });

    it('should throw an error when content type schema fails to create', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const log = new FileLog();

      const contentTypeSchema = {
        id: 'stored-id',
        schemaId,
        body: schemaBodyJson,
        validationLevel: ValidationLevel.CONTENT_TYPE
      } as ContentTypeSchema;
      mockGetContentTypeSchema.mockImplementationOnce(() => {
        throw new Error('Error getting content type schema');
      });
      await expect(doUpdate(client, contentTypeSchema, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('UPDATE')).toEqual([]);
    });
  });

  describe('processSchemas', () => {
    let mockTable: jest.Mock;

    beforeEach(() => {
      mockTable = table as jest.Mock;
      mockTable.mockImplementation(jest.requireActual('table').table);
    });

    it('should successfully create and update a schema', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const hub = new Hub();

      const contentTypeSchemaToCreate = {
        schemaId,
        body: `{\n\t"$schema": "http://json-schema.org/draft-07/schema#",\n\t"$id": "${schemaId}",\n\n\t"title": "Test Schema - Updated",\n\t"description": "Test Schema - Updated",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
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

      await processSchemas(schemasToProcess, client, hub, new FileLog());

      expect(importModule.doCreate).toHaveBeenCalledWith(hub, contentTypeSchemaToCreate, expect.any(FileLog));
      expect(importModule.doUpdate).toHaveBeenCalledWith(client, contentTypeSchemaToUpdate, expect.any(FileLog));
      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('ID'), chalk.bold('Schema ID'), chalk.bold('Result')],
          ['new-id', schemaId, 'CREATED'],
          ['stored-id', schemaId, 'UPDATED']
        ],
        streamTableOptions
      );
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
    const argv = {
      ...yargArgs,
      ...config,
      dir: 'my-dir'
    };

    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });
    });

    it('should process schemas from a local directory', async (): Promise<void> => {
      const schemaToCreate = {
        body: `{\n\t"$schema": "http://json-schema.org/draft-07/schema#",\n\t"$id": "https://schema.localhost.com/remote-test-1.json",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE,
        schemaId: 'create-schema-id'
      };
      const schemaToUpdate = {
        body: `{\n\t"$schema": "http://json-schema.org/draft-07/schema#",\n\t"$id": "https://schema.localhost.com/local-test-2.json",\n\n\t"title": "Test Schema 2",\n\t"description": "Test Schema 2",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE,
        schemaId: 'update-schema-id'
      };

      mockGetHub.mockResolvedValue(new Hub());
      const loadJsonFromDirectoryResult = { 'dir/create.json': schemaToCreate, 'dir/update.json': schemaToUpdate };
      (loadJsonFromDirectory as jest.Mock).mockReturnValueOnce(loadJsonFromDirectoryResult);
      (resolveSchemaBody as jest.Mock).mockImplementation(args => [args, {}]);
      (paginator as jest.Mock).mockResolvedValue([{ ...schemaToUpdate, id: 'stored-id' }]);

      const processSchemasSpy = jest
        .spyOn(importModule, 'processSchemas')
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        .mockImplementation(async (): Promise<void> => {});

      await handler(argv);

      expect(resolveSchemaBody as jest.Mock).toHaveBeenCalledWith(loadJsonFromDirectoryResult, argv.dir);
      expect(loadJsonFromDirectory).toHaveBeenCalledWith('my-dir', ContentTypeSchema);
      expect(paginator).toHaveBeenCalledWith(expect.any(Function));
      expect(processSchemasSpy).toHaveBeenCalledWith(
        [expect.objectContaining(schemaToCreate), expect.objectContaining({ ...schemaToUpdate, id: 'stored-id' })],
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should report all resolve schema body errors', async () => {
      mockGetHub.mockResolvedValue(new Hub());
      (loadJsonFromDirectory as jest.Mock).mockReturnValueOnce({});
      (resolveSchemaBody as jest.Mock).mockResolvedValue([
        {},
        { 'filename.json': new Error('Unable to resolve filename.json') }
      ]);
      await expect(handler(argv)).rejects.toThrowErrorMatchingSnapshot();
    });
  });
});
