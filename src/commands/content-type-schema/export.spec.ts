import * as fs from 'fs';
import * as directoryUtils from '../../common/import/directory-utils';
import * as exportModule from './export';
import {
  builder,
  command,
  filterContentTypeSchemasBySchemaId,
  generateSchemaPath,
  getContentTypeSchemaExports,
  getExportRecordForContentTypeSchema,
  handler,
  LOG_FILENAME,
  processContentTypeSchemas,
  writeSchemaBody
} from './export';
import Yargs from 'yargs/yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentTypeSchema, ValidationLevel } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import * as exportServiceModule from '../../services/export.service';
import { table } from 'table';
import { loadJsonFromDirectory } from '../../services/import.service';
import { resolveSchemaBody } from '../../services/resolve-schema-body';
import { FileLog } from '../../common/file-log';

jest.mock('fs');
jest.mock('../../services/import.service');
jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../services/resolve-schema-body');
jest.mock('table');
jest.mock('../../common/import/directory-utils');

const schemaBody1 = `{\n\t"$schema": "http://json-schema.org/draft-07/schema#",\n\t"$id": "https://schema.localhost.com/remote-test-1.json",\n\n\t"title": "Test Schema 1",\n\t"description": "Test Schema 1",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`;

const schemaBody2 = `{\n\t"$schema": "http://json-schema.org/draft-07/schema#",\n\t"$id": "https://schema.localhost.com/remote-test-2.json",\n\n\t"title": "Test Schema 2",\n\t"description": "Test Schema 2",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`;

const schemaBody3 = `{\n\t"$schema": "http://json-schema.org/draft-07/schema#",\n\t"$id": "https://schema.localhost.com/remote-test-3.json",\n\n\t"title": "Test Schema 3",\n\t"description": "Test Schema 3",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`;

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

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Output directory for the exported Content Type Schema definitions',
        type: 'string'
      });
      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        describe:
          'The Schema ID of a Content Type Schema to be exported.\nIf no --schemaId option is given, all content type schemas for the hub are exported.\nA single --schemaId option may be given to export a single content type schema.\nMultiple --schemaId options may be given to export multiple content type schemas at the same time.',
        requiresArg: true
      });
      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'Overwrite content type schema without asking.'
      });
      expect(spyOption).toHaveBeenCalledWith('archived', {
        type: 'boolean',
        describe: 'If present, archived content type schemas will also be considered.',
        boolean: true
      });
      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.'
      });
    });
  });

  describe('processContentTypeSchemas', () => {
    let mockEnsureDirectory: jest.Mock;
    let mockOverwritePrompt: jest.SpyInstance;
    let mockGetContentTypeSchemaExports: jest.SpyInstance;
    let mockWriteJsonToFile: jest.SpyInstance;
    let mockWriteSchemaBody: jest.SpyInstance;
    let mockTable: jest.Mock;

    const exportedContentTypeSchemas = [
      {
        schemaId: 'content-type-schema-id-1',
        body: schemaBody1,
        validationLevel: ValidationLevel.CONTENT_TYPE
      },
      {
        schemaId: 'content-type-schema-id-2',
        body: schemaBody2,
        validationLevel: ValidationLevel.CONTENT_TYPE
      },
      {
        schemaId: 'content-type-schema-id-3',
        body: schemaBody3,
        validationLevel: ValidationLevel.CONTENT_TYPE
      }
    ];

    const contentTypeSchemasToProcess: ContentTypeSchema[] = [
      new ContentTypeSchema({ id: 'content-type-schema-1', ...exportedContentTypeSchemas[0] }),
      new ContentTypeSchema({ id: 'content-type-schema-2', ...exportedContentTypeSchemas[1] }),
      new ContentTypeSchema({ id: 'content-type-schema-3', ...exportedContentTypeSchemas[2] })
    ];

    beforeEach(() => {
      mockEnsureDirectory = directoryUtils.ensureDirectoryExists as jest.Mock;
      mockOverwritePrompt = jest.spyOn(exportServiceModule, 'promptToOverwriteExports');
      mockGetContentTypeSchemaExports = jest.spyOn(exportModule, 'getContentTypeSchemaExports');
      mockWriteSchemaBody = jest.spyOn(exportModule, 'writeSchemaBody');
      mockWriteJsonToFile = jest.spyOn(exportServiceModule, 'writeJsonToFile');
      mockTable = table as jest.Mock;
      mockTable.mockImplementation(jest.requireActual('table').table);
      mockWriteJsonToFile.mockImplementation();
      mockWriteSchemaBody.mockImplementation();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should output export files for content types schemas if there is nothing previously exported', async () => {
      mockGetContentTypeSchemaExports.mockReturnValueOnce([
        [
          {
            id: '1',
            filename: 'export-dir/export-filename-1.json',
            status: 'CREATED',
            contentTypeSchema: contentTypeSchemasToProcess[0]
          },
          {
            id: '2',
            filename: 'export-dir/export-filename-2.json',
            status: 'CREATED',
            contentTypeSchema: contentTypeSchemasToProcess[1]
          },
          {
            id: '3',
            filename: 'export-dir/export-filename-3.json',
            status: 'CREATED',
            contentTypeSchema: contentTypeSchemasToProcess[2]
          }
        ],
        []
      ]);

      await processContentTypeSchemas('export-dir', {}, contentTypeSchemasToProcess, new FileLog(), false);

      expect(mockGetContentTypeSchemaExports).toHaveBeenCalledTimes(1);
      expect(mockGetContentTypeSchemaExports).toHaveBeenCalledWith('export-dir', {}, contentTypeSchemasToProcess);

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);

      expect(mockWriteJsonToFile).toHaveBeenCalledTimes(3);
      expect(mockWriteJsonToFile.mock.calls).toMatchSnapshot();

      expect(mockWriteSchemaBody).toHaveBeenCalledTimes(3);
      expect(mockWriteSchemaBody.mock.calls).toMatchSnapshot();

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable.mock.calls).toMatchSnapshot();
    });

    it('should not output any export files if a previous export exists and the content type is unchanged', async () => {
      mockGetContentTypeSchemaExports.mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            contentTypeSchema: contentTypeSchemasToProcess[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UP-TO-DATE',
            contentTypeSchema: contentTypeSchemasToProcess[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UP-TO-DATE',
            contentTypeSchema: contentTypeSchemasToProcess[2]
          }
        ],
        []
      ]);

      const previouslyExportedContentTypeSchemas = {
        'export-dir/export-filename-2.json': contentTypeSchemasToProcess[1]
      };
      await processContentTypeSchemas(
        'export-dir',
        previouslyExportedContentTypeSchemas,
        contentTypeSchemasToProcess,
        new FileLog(),
        false
      );

      expect(mockGetContentTypeSchemaExports).toHaveBeenCalledTimes(1);
      expect(mockGetContentTypeSchemaExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedContentTypeSchemas,
        contentTypeSchemasToProcess
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);
      expect(mockWriteJsonToFile).toHaveBeenCalledTimes(0);
      expect(mockWriteSchemaBody).toHaveBeenCalledTimes(0);

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable.mock.calls).toMatchSnapshot();
    });

    it('should update the existing export file for a changed content type', async () => {
      const mutatedContentTypeSchemas = [...contentTypeSchemasToProcess];
      mutatedContentTypeSchemas[2] = new ContentTypeSchema({
        id: 'content-type-schema-3',
        schemaId: 'content-type-schema-id-3',
        body: schemaBody3,
        validationLevel: ValidationLevel.CONTENT_TYPE
      });

      mockOverwritePrompt.mockResolvedValueOnce(true);
      mockGetContentTypeSchemaExports.mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            contentTypeSchema: mutatedContentTypeSchemas[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UP-TO-DATE',
            contentTypeSchema: mutatedContentTypeSchemas[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UPDATED',
            contentTypeSchema: mutatedContentTypeSchemas[2]
          }
        ],
        [
          {
            filename: 'export-dir/export-filename-3.json',
            schemaId: mutatedContentTypeSchemas[2].schemaId as string
          }
        ]
      ]);

      const previouslyExportedContentTypeSchemas = {
        'export-dir/export-filename-3.json': contentTypeSchemasToProcess[2]
      };

      await processContentTypeSchemas(
        'export-dir',
        previouslyExportedContentTypeSchemas,
        mutatedContentTypeSchemas,
        new FileLog(),
        false
      );

      expect(mockGetContentTypeSchemaExports).toHaveBeenCalledTimes(1);
      expect(mockGetContentTypeSchemaExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedContentTypeSchemas,
        mutatedContentTypeSchemas
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);

      expect(mockWriteJsonToFile).toHaveBeenCalledTimes(1);
      expect(mockWriteJsonToFile.mock.calls).toMatchSnapshot();

      expect(mockWriteSchemaBody).toHaveBeenCalledTimes(1);
      expect(mockWriteSchemaBody.mock.calls).toMatchSnapshot();

      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable.mock.calls).toMatchSnapshot();
    });

    it('should not update anything if the user says "n" to the overwrite prompt', async () => {
      const mutatedContentTypeSchemas = [...contentTypeSchemasToProcess];
      mutatedContentTypeSchemas[2] = new ContentTypeSchema({
        id: 'content-type-schema-3',
        schemaId: 'content-type-schema-id-3',
        body: schemaBody3,
        validationLevel: ValidationLevel.CONTENT_TYPE
      });

      const exitError = new Error('ERROR TO VALIDATE PROCESS EXIT');
      jest.spyOn(process, 'exit').mockImplementation(() => {
        throw exitError;
      });
      const stdoutSpy = jest.spyOn(process.stdout, 'write');
      stdoutSpy.mockImplementation();

      mockOverwritePrompt.mockResolvedValueOnce(false);
      mockGetContentTypeSchemaExports.mockReturnValueOnce([
        [
          {
            filename: 'export-dir/export-filename-1.json',
            status: 'UP-TO-DATE',
            contentTypeSchema: mutatedContentTypeSchemas[0]
          },
          {
            filename: 'export-dir/export-filename-2.json',
            status: 'UP-TO-DATE',
            contentTypeSchema: mutatedContentTypeSchemas[1]
          },
          {
            filename: 'export-dir/export-filename-3.json',
            status: 'UPDATED',
            contentTypeSchema: mutatedContentTypeSchemas[2]
          }
        ],
        [
          {
            filename: 'export-dir/export-filename-3.json',
            schemaId: mutatedContentTypeSchemas[2].schemaId as string
          }
        ]
      ]);

      const previouslyExportedContentTypeSchemas = {
        'export-dir/export-filename-3.json': contentTypeSchemasToProcess[2]
      };

      await expect(
        processContentTypeSchemas(
          'export-dir',
          previouslyExportedContentTypeSchemas,
          mutatedContentTypeSchemas,
          new FileLog(),
          false
        )
      ).rejects.toThrowError(exitError);

      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(mockGetContentTypeSchemaExports).toHaveBeenCalledTimes(1);
      expect(mockGetContentTypeSchemaExports).toHaveBeenCalledWith(
        'export-dir',
        previouslyExportedContentTypeSchemas,
        mutatedContentTypeSchemas
      );

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(0);
      expect(mockWriteJsonToFile).toHaveBeenCalledTimes(0);
      expect(mockWriteSchemaBody).toHaveBeenCalledTimes(0);
      expect(mockTable).toHaveBeenCalledTimes(0);
      expect(process.exit).toHaveBeenCalled();
    });

    it('should not do anything if the list of schemas to export is empty', async () => {
      const exitError = new Error('ERROR TO VALIDATE PROCESS EXIT');
      jest.spyOn(process, 'exit').mockImplementation(() => {
        throw exitError;
      });
      const stdoutSpy = jest.spyOn(process.stdout, 'write');
      stdoutSpy.mockImplementation();

      await expect(processContentTypeSchemas('export-dir', {}, [], new FileLog(), false)).rejects.toThrowError(
        exitError
      );

      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(mockGetContentTypeSchemaExports).toHaveBeenCalledTimes(0);

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(0);
      expect(mockWriteJsonToFile).toHaveBeenCalledTimes(0);
      expect(mockWriteSchemaBody).toHaveBeenCalledTimes(0);
      expect(mockTable).toHaveBeenCalledTimes(0);
      expect(process.exit).toHaveBeenCalled();
    });
  });

  describe('getContentTypeSchemaExports', () => {
    let getExportRecordForContentTypeSchemaSpy: jest.SpyInstance;

    const contentTypeSchemasToExport = [
      new ContentTypeSchema({
        schemaId: 'content-type-schema-id-1',
        body: schemaBody1,
        validationLevel: ValidationLevel.CONTENT_TYPE
      }),
      new ContentTypeSchema({
        schemaId: 'content-type-schema-id-2',
        body: schemaBody2,
        validationLevel: ValidationLevel.CONTENT_TYPE
      })
    ];

    const exportedContentTypeSchemas = {
      'export-dir/export-filename-1.json': contentTypeSchemasToExport[0],
      'export-dir/export-filename-2.json': contentTypeSchemasToExport[1]
    };

    beforeEach(() => {
      getExportRecordForContentTypeSchemaSpy = jest.spyOn(exportModule, 'getExportRecordForContentTypeSchema');
    });

    it('should return a list of content-type-schemas to export and no filenames that will be updated (first export)', () => {
      getExportRecordForContentTypeSchemaSpy
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-1.json',
          status: 'CREATED',
          contentType: contentTypeSchemasToExport[0]
        })
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-2.json',
          status: 'CREATED',
          contentType: contentTypeSchemasToExport[1]
        });

      const [allExports, updatedExportsMap] = getContentTypeSchemaExports('export-dir', {}, contentTypeSchemasToExport);

      expect(getExportRecordForContentTypeSchemaSpy).toHaveBeenCalledTimes(2);
      expect(getExportRecordForContentTypeSchemaSpy.mock.calls).toMatchSnapshot();
      expect(allExports).toMatchSnapshot();
      expect(updatedExportsMap).toEqual([]);
    });

    it('should return a list of content-type-schemas to export and a list of filenames that will be updated', () => {
      getExportRecordForContentTypeSchemaSpy
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-1.json',
          status: 'CREATED',
          contentType: contentTypeSchemasToExport[0]
        })
        .mockReturnValueOnce({
          filename: 'export-dir/export-filename-2.json',
          status: 'UPDATED',
          contentType: contentTypeSchemasToExport[1]
        });

      const [allExports, updatedExportsMap] = getContentTypeSchemaExports(
        'export-dir',
        exportedContentTypeSchemas,
        contentTypeSchemasToExport
      );

      expect(getExportRecordForContentTypeSchemaSpy).toHaveBeenCalledTimes(2);
      expect(getExportRecordForContentTypeSchemaSpy.mock.calls).toMatchSnapshot();
      expect(allExports).toMatchSnapshot();
      expect(updatedExportsMap).toMatchSnapshot();
    });

    it('should not return a list of content-types to export or a list of filenames that will be updated', () => {
      const [allExports, updatedExportsMap] = getContentTypeSchemaExports('export-dir', {}, []);

      expect(getExportRecordForContentTypeSchemaSpy).toHaveBeenCalledTimes(0);
      expect(allExports).toEqual([]);
      expect(updatedExportsMap).toEqual([]);
    });

    it('should skip any that do not have a schemaId', () => {
      const skippedSchema = new ContentTypeSchema({
        body: schemaBody1,
        validationLevel: ValidationLevel.CONTENT_TYPE
      });
      const [allExports, updatedExportsMap] = getContentTypeSchemaExports('export-dir', {}, [skippedSchema]);

      expect(getExportRecordForContentTypeSchemaSpy).toHaveBeenCalledTimes(0);
      expect(allExports).toEqual([]);
      expect(updatedExportsMap).toEqual([]);
    });
  });

  describe('getExportRecordForContentTypeSchema', () => {
    let uniqueFilenameSpy: jest.SpyInstance;
    const exportedContentTypeSchemas = {
      'export-dir/export-filename-1.json': new ContentTypeSchema({
        schemaId: 'content-type-schema-id-1',
        body: schemaBody1,
        validationLevel: ValidationLevel.CONTENT_TYPE
      }),
      'export-dir/export-filename-2.json': new ContentTypeSchema({
        schemaId: 'content-type-schema-id-2',
        body: schemaBody2,
        validationLevel: ValidationLevel.CONTENT_TYPE
      })
    };

    beforeEach(() => {
      uniqueFilenameSpy = jest.spyOn(exportServiceModule, 'uniqueFilename');
    });

    it('should not find any existing files for the exported schemas', async () => {
      const newContentTypeSchemaToExport = new ContentTypeSchema({
        schemaId: 'content-type-schema-id-1',
        body: schemaBody1,
        validationLevel: ValidationLevel.CONTENT_TYPE
      });

      uniqueFilenameSpy.mockReturnValueOnce('export-dir/export-filename-1.json');

      const result = getExportRecordForContentTypeSchema(newContentTypeSchemaToExport, 'export-dir', {});

      expect(uniqueFilenameSpy.mock.calls).toMatchSnapshot();
      expect(result).toEqual({
        filename: 'export-dir/export-filename-1.json',
        status: 'CREATED',
        contentTypeSchema: newContentTypeSchemaToExport
      });
    });

    it('should create a new file for any missing schemas', async () => {
      const newContentTypeSchemaToExport = new ContentTypeSchema({
        schemaId: 'content-type-schema-id-3',
        body: schemaBody3,
        validationLevel: ValidationLevel.CONTENT_TYPE
      });

      uniqueFilenameSpy.mockReturnValueOnce('export-dir/export-filename-3.json');

      const result = getExportRecordForContentTypeSchema(
        newContentTypeSchemaToExport,
        'export-dir',
        exportedContentTypeSchemas
      );

      expect(uniqueFilenameSpy.mock.calls).toMatchSnapshot();
      expect(result).toEqual({
        filename: 'export-dir/export-filename-3.json',
        status: 'CREATED',
        contentTypeSchema: newContentTypeSchemaToExport
      });
    });

    it('should update a schema with different content', async () => {
      const newContentTypeSchemaToExport = new ContentTypeSchema({
        schemaId: 'content-type-schema-id-2',
        body: `{\n\t"$schema": "http://json-schema.org/draft-07/schema#",\n\t"$id": "https://schema.localhost.com/updated-test-2.json",\n\n\t"title": "Test Schema 2 Updated",\n\t"description": "Test Schema 2 Updated",\n\n\t"allOf": [\n\t\t{\n\t\t\t"$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content"\n\t\t}\n\t],\n\t\n\t"type": "object",\n\t"properties": {\n\t\t\n\t},\n\t"propertyOrder": []\n}`,
        validationLevel: ValidationLevel.CONTENT_TYPE
      });

      const result = getExportRecordForContentTypeSchema(
        newContentTypeSchemaToExport,
        'export-dir',
        exportedContentTypeSchemas
      );

      expect(uniqueFilenameSpy).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        filename: 'export-dir/export-filename-2.json',
        status: 'UPDATED',
        contentTypeSchema: newContentTypeSchemaToExport
      });
    });

    it('should not update any schemas with same content', async () => {
      const newContentTypeSchemaToExport = new ContentTypeSchema({
        schemaId: 'content-type-schema-id-2',
        body: schemaBody2,
        validationLevel: ValidationLevel.CONTENT_TYPE
      });

      const result = getExportRecordForContentTypeSchema(
        newContentTypeSchemaToExport,
        'export-dir',
        exportedContentTypeSchemas
      );

      expect(uniqueFilenameSpy).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        filename: 'export-dir/export-filename-2.json',
        status: 'UP-TO-DATE',
        contentTypeSchema: newContentTypeSchemaToExport
      });
    });
  });

  describe('filterContentTypeSchemasBySchemaId', () => {
    const listToFilter = [
      new ContentTypeSchema({
        schemaId: 'content-type-schema-id-1',
        body: schemaBody1,
        validationLevel: ValidationLevel.CONTENT_TYPE
      }),
      new ContentTypeSchema({
        schemaId: 'content-type-schema-id-2',
        body: schemaBody2,
        validationLevel: ValidationLevel.CONTENT_TYPE
      }),
      new ContentTypeSchema({
        schemaId: 'content-type-schema-id-3',
        body: schemaBody3,
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

    it('should return all the content type schemas if a filter list is set to undefined', async () => {
      const result = filterContentTypeSchemasBySchemaId(listToFilter);
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
    const contentTypeSchemasToExport: ContentTypeSchema[] = [
      new ContentTypeSchema({
        schemaId: 'content-type-schema-id-1',
        body: schemaBody1,
        validationLevel: ValidationLevel.CONTENT_TYPE
      }),
      new ContentTypeSchema({
        schemaId: 'content-type-schema-id-2',
        body: schemaBody2,
        validationLevel: ValidationLevel.CONTENT_TYPE
      }),
      new ContentTypeSchema({
        schemaId: 'content-type-schema-id-3',
        body: schemaBody3,
        validationLevel: ValidationLevel.CONTENT_TYPE
      })
    ];
    const listResponse = new MockPage(ContentTypeSchema, contentTypeSchemasToExport);
    const mockList = jest.fn();
    const mockGetHub = jest.fn();
    const resolveSchemaBodyMock = resolveSchemaBody as jest.Mock;
    let filterContentTypeSchemasBySchemaIdSpy: jest.SpyInstance;
    let processContentTypeSchemasSpy: jest.SpyInstance;

    beforeEach(() => {
      filterContentTypeSchemasBySchemaIdSpy = jest.spyOn(exportModule, 'filterContentTypeSchemasBySchemaId');
      processContentTypeSchemasSpy = jest.spyOn(exportModule, 'processContentTypeSchemas');
      processContentTypeSchemasSpy.mockImplementation();
      resolveSchemaBodyMock.mockImplementation(async schemas => [schemas, []]);
      mockList.mockResolvedValue(listResponse);
      mockGetHub.mockResolvedValue({
        related: {
          contentTypeSchema: {
            list: mockList
          }
        }
      });
      (loadJsonFromDirectory as jest.Mock).mockReturnValue({});
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });
    });

    function expectProcessArguments(dir: string, schemas: ContentTypeSchema[]): void {
      expect(processContentTypeSchemasSpy.mock.calls[0].slice(0, 3)).toEqual([dir, {}, schemas]);
    }

    it('should export all content type schemas for the current hub', async (): Promise<void> => {
      filterContentTypeSchemasBySchemaIdSpy.mockReturnValue(contentTypeSchemasToExport);

      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: [] };
      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalled();
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentTypeSchema);
      expect(resolveSchemaBodyMock).toHaveBeenCalledWith({}, 'my-dir');
      expect(filterContentTypeSchemasBySchemaIdSpy).toHaveBeenCalledWith(contentTypeSchemasToExport, []);
      expectProcessArguments(argv.dir, contentTypeSchemasToExport);
    });

    it('should ignore any resolve schema errors', async (): Promise<void> => {
      resolveSchemaBodyMock.mockImplementation(async schemas => [schemas, { file: new Error('Cannot find file') }]);
      filterContentTypeSchemasBySchemaIdSpy.mockReturnValue(contentTypeSchemasToExport);

      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: [] };
      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalled();
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentTypeSchema);
      expect(resolveSchemaBodyMock).toHaveBeenCalledWith({}, 'my-dir');
      expect(filterContentTypeSchemasBySchemaIdSpy).toHaveBeenCalledWith(contentTypeSchemasToExport, []);
      expectProcessArguments(argv.dir, contentTypeSchemasToExport);
    });

    it('should export all content type schemas for the current hub if schemaId is not supplied', async (): Promise<
      void
    > => {
      filterContentTypeSchemasBySchemaIdSpy.mockReturnValue(contentTypeSchemasToExport);

      const argv = { ...yargArgs, ...config, dir: 'my-dir' };
      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalled();
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentTypeSchema);
      expect(resolveSchemaBodyMock).toHaveBeenCalledWith({}, 'my-dir');
      expect(filterContentTypeSchemasBySchemaIdSpy).toHaveBeenCalledWith(contentTypeSchemasToExport, []);
      expectProcessArguments(argv.dir, contentTypeSchemasToExport);
    });

    it('should export only the specified content type schema when schemaId is provided', async (): Promise<void> => {
      const filteredContentTypeSchemas = contentTypeSchemasToExport.slice(0, 1);
      filterContentTypeSchemasBySchemaIdSpy.mockReturnValue(filteredContentTypeSchemas);

      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: ['content-type-schema-id-1'] };
      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalled();
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentTypeSchema);
      expect(resolveSchemaBodyMock).toHaveBeenCalledWith({}, 'my-dir');
      expect(filterContentTypeSchemasBySchemaIdSpy).toHaveBeenCalledWith(contentTypeSchemasToExport, [
        'content-type-schema-id-1'
      ]);
      expectProcessArguments(argv.dir, filteredContentTypeSchemas);
    });

    it('should export all content type schemas when schemaId is undefined', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: undefined };
      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalledWith({ size: 100, status: 'ACTIVE' });
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentTypeSchema);
      expect(resolveSchemaBodyMock).toHaveBeenCalledWith({}, 'my-dir');
      expect(filterContentTypeSchemasBySchemaIdSpy).toHaveBeenCalledWith(contentTypeSchemasToExport, []);
      expectProcessArguments(argv.dir, contentTypeSchemasToExport);
    });

    it('should export all content type schemas when schemaId is an empty array', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: [] };
      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalledWith({ size: 100, status: 'ACTIVE' });
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentTypeSchema);
      expect(resolveSchemaBodyMock).toHaveBeenCalledWith({}, 'my-dir');
      expect(filterContentTypeSchemasBySchemaIdSpy).toHaveBeenCalledWith(contentTypeSchemasToExport, []);
      expectProcessArguments(argv.dir, contentTypeSchemasToExport);
    });

    it('should export even archived content type schemas when --archived is provided', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', schemaId: undefined, archived: true };
      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(mockList).toHaveBeenCalledWith({ size: 100 });
      expect(loadJsonFromDirectory).toHaveBeenCalledWith(argv.dir, ContentTypeSchema);
      expect(resolveSchemaBodyMock).toHaveBeenCalledWith({}, 'my-dir');
      expect(filterContentTypeSchemasBySchemaIdSpy).toHaveBeenCalledWith(contentTypeSchemasToExport, []);
      expectProcessArguments(argv.dir, contentTypeSchemasToExport);
    });
  });

  describe('generateSchemaPath', () => {
    it('should return a path to a schema', async () => {
      const res = generateSchemaPath('export-dir/export-filename-1.json');
      expect(res).toEqual('schemas/export-filename-1-schema.json');
    });
  });

  describe('writeSchemaBody', () => {
    const writeFileSyncMock = fs.writeFileSync as jest.Mock;
    const existsSyncMock = fs.existsSync as jest.Mock;
    const lstatSyncMock = fs.lstatSync as jest.Mock;
    const mkdirSyncMock = fs.mkdirSync as jest.Mock;

    afterEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();
    });

    it('should write a body to file and create schemas directory if it doesnt exist', async () => {
      existsSyncMock.mockReturnValue(false);

      writeSchemaBody('schemas/export-filename-1.json', '{}');

      expect(writeFileSyncMock.mock.calls).toMatchSnapshot();
      expect(existsSyncMock).toHaveBeenCalledWith('schemas');
      expect(mkdirSyncMock).toHaveBeenCalledWith('schemas');
    });

    it('should report and error when its not possible to create the directory if it doesnt exist', async () => {
      existsSyncMock.mockReturnValue(false);
      mkdirSyncMock.mockImplementation(() => {
        throw new Error('Unable to create dir');
      });

      expect(() => writeSchemaBody('schemas/export-filename-1.json', '{}')).toThrowErrorMatchingSnapshot();

      expect(writeFileSyncMock).not.toHaveBeenCalled();
      expect(existsSyncMock).toHaveBeenCalledWith('schemas');
      expect(mkdirSyncMock).toHaveBeenCalledWith('schemas');
    });

    it('should write a body to file and use the schema dir if it does exist', async () => {
      existsSyncMock.mockReturnValue(true);
      lstatSyncMock.mockReturnValue({ isDirectory: () => true });

      writeSchemaBody('schemas/export-filename-1.json', '{}');

      expect(writeFileSyncMock.mock.calls).toMatchSnapshot();
      expect(existsSyncMock).toHaveBeenCalledWith('schemas');
      expect(lstatSyncMock).toHaveBeenCalledWith('schemas');
      expect(mkdirSyncMock).not.toHaveBeenCalled();
    });

    it('should not write a body if there is not one to write', async () => {
      writeSchemaBody('schemas/export-filename-1.json', undefined);
      expect(writeFileSyncMock).not.toHaveBeenCalled();
      expect(existsSyncMock).not.toHaveBeenCalled();
      expect(lstatSyncMock).not.toHaveBeenCalled();
      expect(mkdirSyncMock).not.toHaveBeenCalled();
    });

    it('should not write a body if schema dir is not a dir', () => {
      existsSyncMock.mockReturnValue(true);
      lstatSyncMock.mockReturnValue({ isDirectory: () => false });

      expect(() => writeSchemaBody('schemas/export-filename-1.json', '{}')).toThrowErrorMatchingSnapshot();
      expect(existsSyncMock).toHaveBeenCalledWith('schemas');
      expect(lstatSyncMock).toHaveBeenCalledWith('schemas');
    });

    it('should throw an error if the file could not be wrote', async () => {
      existsSyncMock.mockReturnValue(true);
      lstatSyncMock.mockReturnValue({ isDirectory: () => true });

      writeFileSyncMock.mockImplementationOnce(() => {
        throw new Error('write failure');
      });

      expect(() => {
        writeSchemaBody('schemas/export-filename-1.json', '{}');
      }).toThrowErrorMatchingSnapshot();
      expect(existsSyncMock).toHaveBeenCalledWith('schemas');
      expect(lstatSyncMock).toHaveBeenCalledWith('schemas');
      expect(writeFileSyncMock.mock.calls).toMatchSnapshot();
    });
  });
});
