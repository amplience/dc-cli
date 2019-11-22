import * as exportModule from './export';
import {
  builder,
  command,
  filterContentTypeSchemasBySchemaId,
  getExportRecordForContentTypeSchema,
  handler,
  processContentTypeSchemas
} from './export';
import Yargs from 'yargs/yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentTypeSchema, ValidationLevel } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import * as exportServiceModule from '../../services/export.service';
import { createStream } from 'table';
import { loadJsonFromDirectory } from '../../services/import.service';

jest.mock('../../services/import.service');
jest.mock('../../services/dynamic-content-client-factory');
jest.mock('table');

describe('content-type-schema export command', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should implement an export command', () => {
    expect(command).toEqual('export <dir>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();
      const spyArray = jest.spyOn(argv, 'array').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Output directory for the exported Content Type Schema definitions',
        type: 'string'
      });
      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        describe: 'content-type-schema ID(s) to export',
        requiresArg: true
      });
      expect(spyArray).toHaveBeenCalledWith('schemaId');
    });
  });

  describe('processContentTypeSchemas', () => {
    const mockStreamWrite = jest.fn();

    beforeEach(() => {
      (createStream as jest.Mock).mockReturnValue({
        write: mockStreamWrite
      });
    });

    it('should output export files for all specified content types', async () => {
      const exportedContentTypeSchemas = [
        {
          schemaId: 'content-type-schema-id-1',
          body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-1.json",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
          validationLevel: ValidationLevel.CONTENT_TYPE
        },
        {
          schemaId: 'content-type-schema-id-2',
          body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-2.json",\n\n\t"title": "Test Schema 2",\n\t"description": "Test Schema 2",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
          validationLevel: ValidationLevel.CONTENT_TYPE
        },
        {
          schemaId: 'content-type-schema-id-3',
          body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-3.json",\n\n\t"title": "Test Schema 3",\n\t"description": "Test Schema 3",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
          validationLevel: ValidationLevel.CONTENT_TYPE
        }
      ];

      const contentTypeSchemasToProcess: ContentTypeSchema[] = [
        new ContentTypeSchema(exportedContentTypeSchemas[0]),
        new ContentTypeSchema(exportedContentTypeSchemas[1]),
        new ContentTypeSchema(exportedContentTypeSchemas[2])
      ];

      const mockGetExportRecordForContentTypeSchema = jest.spyOn(exportModule, 'getExportRecordForContentTypeSchema');
      const mockWriteJsonToFile = jest.spyOn(exportServiceModule, 'writeJsonToFile');

      mockGetExportRecordForContentTypeSchema
        .mockReturnValueOnce({ filename: 'export-dir/export-filename-1.json', status: 'CREATED' })
        .mockReturnValueOnce({ filename: 'export-dir/export-filename-2.json', status: 'CREATED' })
        .mockReturnValueOnce({ filename: 'export-dir/export-filename-3.json', status: 'CREATED' });

      mockWriteJsonToFile.mockImplementation();

      await processContentTypeSchemas('export-dir', {}, contentTypeSchemasToProcess);

      expect(mockGetExportRecordForContentTypeSchema).toHaveBeenCalledTimes(3);
      expect(mockGetExportRecordForContentTypeSchema.mock.calls).toMatchSnapshot();

      expect(mockWriteJsonToFile).toHaveBeenCalledTimes(3);
      expect(mockWriteJsonToFile.mock.calls).toMatchSnapshot();

      expect(mockStreamWrite).toHaveBeenCalledTimes(4);
      expect(mockStreamWrite.mock.calls).toMatchSnapshot();
    });
  });

  describe('getExportRecordForContentTypeSchema', () => {
    const exportedContentTypeSchemas = {
      'export-dir/export-filename-1.json': new ContentTypeSchema({
        schemaId: 'content-type-schema-id-1',
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-1.json",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      }),
      'export-dir/export-filename-2.json': new ContentTypeSchema({
        schemaId: 'content-type-schema-id-2',
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-2.json",\n\n\t"title": "Test Schema 2",\n\t"description": "Test Schema 2",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      })
    };

    it('should not find any existing files for the exported schemas', async () => {
      const newContentTypeSchemaToExport = new ContentTypeSchema({
        schemaId: 'content-type-schema-id-1',
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-1.json",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      });

      jest.spyOn(exportServiceModule, 'uniqueFilename').mockReturnValueOnce('export-dir/export-filename-1.json');

      const result = getExportRecordForContentTypeSchema(newContentTypeSchemaToExport, 'export-dir', {});

      expect(exportServiceModule.uniqueFilename).toHaveBeenCalledWith('export-dir', 'json');
      expect(result).toEqual({ filename: 'export-dir/export-filename-1.json', status: 'CREATED' });
    });

    it('should create a new file for any missing schemas', async () => {
      const newContentTypeSchemaToExport = new ContentTypeSchema({
        schemaId: 'content-type-schema-id-3',
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-3.json",\n\n\t"title": "Test Schema 3",\n\t"description": "Test Schema 3",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      });

      jest.spyOn(exportServiceModule, 'uniqueFilename').mockReturnValueOnce('export-dir/export-filename-3.json');

      const result = getExportRecordForContentTypeSchema(
        newContentTypeSchemaToExport,
        'export-dir',
        exportedContentTypeSchemas
      );

      expect(exportServiceModule.uniqueFilename).toHaveBeenCalledWith('export-dir', 'json');
      expect(result).toEqual({ filename: 'export-dir/export-filename-3.json', status: 'CREATED' });
    });

    it('should update a schema with different content', async () => {
      const newContentTypeSchemaToExport = new ContentTypeSchema({
        schemaId: 'content-type-schema-id-2',
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/updated-test-2.json",\n\n\t"title": "Test Schema 2 Updated",\n\t"description": "Test Schema 2 Updated",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      });

      jest.spyOn(exportServiceModule, 'uniqueFilename');

      const result = getExportRecordForContentTypeSchema(
        newContentTypeSchemaToExport,
        'export-dir',
        exportedContentTypeSchemas
      );

      expect(exportServiceModule.uniqueFilename).toHaveBeenCalledTimes(0);
      expect(result).toEqual({ filename: 'export-dir/export-filename-2.json', status: 'UPDATED' });
    });

    it('should not update any schemas with same content', async () => {
      const newContentTypeSchemaToExport = new ContentTypeSchema({
        schemaId: 'content-type-schema-id-2',
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-2.json",\n\n\t"title": "Test Schema 2",\n\t"description": "Test Schema 2",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      });

      jest.spyOn(exportServiceModule, 'uniqueFilename');

      const result = getExportRecordForContentTypeSchema(
        newContentTypeSchemaToExport,
        'export-dir',
        exportedContentTypeSchemas
      );

      expect(exportServiceModule.uniqueFilename).toHaveBeenCalledTimes(0);
      expect(result).toEqual({ filename: 'export-dir/export-filename-2.json', status: 'UP-TO-DATE' });
    });
  });

  describe('filterContentTypeSchemasBySchemaId', () => {
    const listToFilter = [
      new ContentTypeSchema({
        schemaId: 'content-type-schema-id-1',
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-1.json",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      }),
      new ContentTypeSchema({
        schemaId: 'content-type-schema-id-2',
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-2.json",\n\n\t"title": "Test Schema 2",\n\t"description": "Test Schema 2",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      }),
      new ContentTypeSchema({
        schemaId: 'content-type-schema-id-3',
        body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-3.json",\n\n\t"title": "Test Schema 3",\n\t"description": "Test Schema 3",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      })
    ];

    it('should return the content types matching the given schemaIds', async () => {
      const result = filterContentTypeSchemasBySchemaId(listToFilter, [
        'content-type-schema-id-1',
        'content-type-schema-id-3'
      ]);
      expect(result).toMatchSnapshot();
    });

    it('should return all the content type schemas if a filter list is not provided', async () => {
      const result = filterContentTypeSchemasBySchemaId(listToFilter, []);
      expect(result).toMatchSnapshot();
    });

    it('should throw an error for schemaIds which do not exist in the list', async () => {
      expect(() =>
        filterContentTypeSchemasBySchemaId(listToFilter, ['content-type-schema-id-4'])
      ).toThrowErrorMatchingSnapshot();
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

      mockGetHub.mockResolvedValue({
        related: {
          ContentTypeSchemas: {
            list: jest.fn()
          }
        }
      });
    });

    it('should export all content type schemas for the current hub', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: [] };
      const ContentTypeSchemasToExport: ContentTypeSchema[] = [
        new ContentTypeSchema({
          schemaId: 'content-type-schema-id-1',
          body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-1.json",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
          validationLevel: ValidationLevel.CONTENT_TYPE
        }),
        new ContentTypeSchema({
          schemaId: 'content-type-schema-id-2',
          body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-2.json",\n\n\t"title": "Test Schema 2",\n\t"description": "Test Schema 2",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
          validationLevel: ValidationLevel.CONTENT_TYPE
        }),
        new ContentTypeSchema({
          schemaId: 'content-type-schema-id-3',
          body: `{\n\t"$schema": "http://json-schema.org/draft-04/schema#",\n\t"id": "https://schema.localhost.com/remote-test-3.json",\n\n\t"title": "Test Schema 3",\n\t"description": "Test Schema 3",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
          validationLevel: ValidationLevel.CONTENT_TYPE
        })
      ];

      (loadJsonFromDirectory as jest.Mock).mockReturnValue([]);

      const listResponse = new MockPage(ContentTypeSchema, ContentTypeSchemasToExport);
      const mockList = jest.fn().mockResolvedValue(listResponse);

      const mockGetHub = jest.fn().mockResolvedValue({
        related: {
          contentTypeSchema: {
            list: mockList
          }
        }
      });

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });
      jest.spyOn(exportModule, 'processContentTypeSchemas').mockResolvedValueOnce();

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalled();
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentTypeSchema);
      expect(exportModule.processContentTypeSchemas).toHaveBeenCalledWith(argv.dir, [], ContentTypeSchemasToExport);
    });
  });
});
