import Yargs = require('yargs/yargs');
import fs from 'fs';
import { command, builder, handler } from './import';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { ContentTypeSchema, ValidationLevel } from 'dc-management-sdk-js';
import { createStream } from 'table';
import chalk from 'chalk';
import { getRemoteFileList } from '../../common/list-remote-files';
import { getSchemaBody } from './helper/content-type-schema.helper';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('fs');
jest.mock('table');
jest.mock('../../common/list-remote-files');
jest.mock('./helper/content-type-schema.helper');

describe('content-type-schema import command', (): void => {
  afterEach((): void => {
    jest.resetAllMocks();
  });

  it('should implement an import command', () => {
    expect(command).toEqual('import');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();
      const spyDemandCommand = jest.spyOn(argv, 'demandCommand').mockReturnThis();

      builder(argv);

      expect(spyOptions).toHaveBeenCalledWith({
        dir: {
          describe: 'Path to Content Type Schema definitions',
          type: 'string'
        },
        remote: {
          describe: 'Path to file referencing remote Content Type Schema definitions',
          type: 'string'
        },
        validationLevel: {
          type: 'string',
          choices: Object.values(ValidationLevel),
          demandOption: true,
          description: 'content-type-schema Validation Level'
        }
      });

      expect(spyDemandCommand).toHaveBeenCalledWith(2);
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
        '{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/test-1.json",\n\n\t"title": "Test Schema",\n\t"description": "Test Schema",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}',
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
      const argv = {
        ...yargArgs,
        ...config,
        dir: 'my-dir',
        remote: 'my-remote-list',
        validationLevel: ValidationLevel.SLOT
      };
      const mockFileNames: string[] = ['a.json'];

      const schemaToUpdate = new ContentTypeSchema({
        ...storedContentTypeSchema,
        body:
          '{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/test-1.json",\n\n\t"title": "Test Schema - Updated",\n\t"description": "Test Schema - Updated",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}'
      });
      const schemaToCreate = {
        ...storedContentTypeSchema,
        schemaId: 'https://schema.localhost.com/new-test-1.json',
        body:
          '{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/new-test-1.json",\n\n\t"title": "Test Schema - Updated",\n\t"description": "Test Schema - Updated",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}'
      };
      delete schemaToCreate.id;

      mockFileReadDir.mockReturnValue(mockFileNames);
      (getRemoteFileList as jest.Mock).mockReturnValue([{ uri: 'https://example.com/a.json' }]);
      (getSchemaBody as jest.Mock).mockReturnValueOnce(schemaToUpdate.body).mockReturnValueOnce(schemaToCreate.body);

      const storedSchema = new ContentTypeSchema(storedContentTypeSchema);

      mockUpdate.mockResolvedValue(schemaToUpdate);
      storedSchema.related.update = mockUpdate;
      mockGetContentTypeSchema.mockResolvedValue(storedSchema);
      mockCreate.mockResolvedValue(new ContentTypeSchema(schemaToCreate));

      await handler(argv);

      expect(mockGetHub).toBeCalledWith('hub-id');
      expect(mockList).toBeCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ ...schemaToCreate, validationLevel: ValidationLevel.SLOT })
      );
      expect(mockGetContentTypeSchema).toHaveBeenCalledTimes(1);
      expect(mockGetContentTypeSchema).toHaveBeenCalledWith('stored-id');
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ body: schemaToUpdate.body, validationLevel: ValidationLevel.SLOT })
      );
      expect(mockStreamWrite).toHaveBeenCalledTimes(3);
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

    it('should abort on first failure when create content type schema (from directory) throws an error', async (): Promise<
      void
    > => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', validationLevel: ValidationLevel.CONTENT_TYPE };
      const mockFileNames: string[] = ['a.json'];

      mockFileReadDir.mockReturnValue(mockFileNames);
      mockCreate.mockRejectedValueOnce(new Error('Failed to create'));

      const schemaToCreate = {
        ...storedContentTypeSchema,
        schemaId: 'https://schema.localhost.com/new-test-1.json',
        body:
          '{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/new-test-1.json",\n\n\t"title": "Test Schema - Updated",\n\t"description": "Test Schema - Updated",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}'
      };
      delete schemaToCreate.id;

      (getSchemaBody as jest.Mock).mockReturnValueOnce(schemaToCreate.body);

      await expect(handler(argv)).rejects.toThrowError(/Error registering content type schema with body/);
      expect(mockGetHub).toBeCalledWith('hub-id');
      expect(mockList).toBeCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining(schemaToCreate));
      expect(mockCreate).toBeCalledTimes(1);
      expect(mockUpdate).toBeCalledTimes(0);
      expect(mockStreamWrite).toHaveBeenCalledTimes(1);
    });

    it('should abort on first failure when update content type schema (from directory) throws an error', async (): Promise<
      void
    > => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', validationLevel: ValidationLevel.CONTENT_TYPE };
      const mockFileNames: string[] = ['a.json'];

      mockFileReadDir.mockReturnValue(mockFileNames);

      const schemaToUpdate = new ContentTypeSchema({
        ...storedContentTypeSchema,
        body:
          '{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/test-1.json",\n\n\t"title": "Test Schema - Updated",\n\t"description": "Test Schema - Updated",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}'
      });

      const storedSchema = new ContentTypeSchema(storedContentTypeSchema);
      mockUpdate.mockRejectedValueOnce(new Error('Failed to update'));
      storedSchema.related.update = mockUpdate;
      mockGetContentTypeSchema.mockResolvedValue(storedSchema);

      (getSchemaBody as jest.Mock).mockReturnValueOnce(schemaToUpdate.body);

      await expect(handler(argv)).rejects.toThrowError(
        'Error updating content type schema https://schema.localhost.com/test-1.json: Failed to update'
      );
      expect(mockGetHub).toBeCalledWith('hub-id');
      expect(mockList).toBeCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ body: schemaToUpdate.body, validationLevel: schemaToUpdate.validationLevel })
      );
      expect(mockUpdate).toBeCalledTimes(1);
      expect(mockCreate).toBeCalledTimes(0);
      expect(mockStreamWrite).toHaveBeenCalledTimes(1);
    });

    it('should output status as update skipped when content type schema (from directory) has no differences', async (): Promise<
      void
    > => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', validationLevel: ValidationLevel.CONTENT_TYPE };
      const mockFileNames: string[] = ['a.json'];

      mockFileReadDir.mockReturnValue(mockFileNames);

      const schemaToUpdate = new ContentTypeSchema(storedContentTypeSchema);

      (getSchemaBody as jest.Mock).mockReturnValueOnce(schemaToUpdate.body);

      const storedSchema = new ContentTypeSchema(storedContentTypeSchema);

      mockUpdate.mockResolvedValue(schemaToUpdate.body);
      storedSchema.related.update = mockUpdate;
      mockGetContentTypeSchema.mockResolvedValue(storedSchema);

      await handler(argv);

      expect(mockGetHub).toBeCalledWith('hub-id');
      expect(mockList).toBeCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledTimes(0);
      expect(mockGetContentTypeSchema).toHaveBeenCalledTimes(1);
      expect(mockGetContentTypeSchema).toHaveBeenCalledWith('stored-id');
      expect(mockUpdate).toHaveBeenCalledTimes(0);
      expect(mockStreamWrite).toHaveBeenCalledTimes(2);
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
        'SKIPPED'
      ]);
    });
  });
});
