// TESTS
// should unarchive a content-type-schema by id
// should unarchive a content-type-schema by schema id with --schemaId
// should unarchive content-type-schemas by regex on schema id with --schemaId
// should unarchive content-type-schemas specified in the provided --revertLog

import { builder, command, handler } from './unarchive';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentTypeSchema, Hub } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { dirname } from 'path';
import { exists, writeFile, mkdir, rmdir } from 'fs';
import { promisify } from 'util';

jest.mock('readline');

jest.mock('../../services/dynamic-content-client-factory');

describe('content-item-schema unarchive command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function() {
    expect(command).toEqual('unarchive [id]');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        type: 'string',
        describe:
          'The ID of a schema to be unarchived. Note that this is different from the schema ID - which is in a URL format.'
      });

      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        describe:
          'The Schema ID of a Content Type Schema to be unarchived.\nA regex can be provided to \nA single --schemaId option may be given to unarchive a single content type schema.\nMultiple --schemaId options may be given to unarchive multiple content type schemas at the same time.',
        requiresArg: true
      });

      expect(spyOption).toHaveBeenCalledWith('revertLog', {
        type: 'string',
        describe:
          'Path to a log file containing content archived in a previous run of the archive command.\nWhen provided, unarchives all schemas listed as archived in the log file.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('ignoreError', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, unarchive requests that fail will not abort the process.'
      });
    });
  });

  describe('handler tests', function() {
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

    function generateMockSchemaList(
      names: string[],
      enrich: (schema: ContentTypeSchema) => void
    ): MockPage<ContentTypeSchema> {
      const contentTypeSchemaResponse: ContentTypeSchema[] = names.map(name => {
        const mockUnarchive = jest.fn();

        const unarchiveResponse = new ContentTypeSchema({ schemaId: name });
        unarchiveResponse.related.unarchive = mockUnarchive;

        mockUnarchive.mockResolvedValue(unarchiveResponse);

        enrich(unarchiveResponse);
        return unarchiveResponse;
      });

      return new MockPage(ContentTypeSchema, contentTypeSchemaResponse);
    }

    function injectSchemaMocks(names: string[], enrich: (schema: ContentTypeSchema) => void): void {
      const mockHubGet = jest.fn();
      const mockHubList = jest.fn();

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockHubGet
        }
      });

      const mockHub = new Hub();
      mockHub.related.contentTypeSchema.list = mockHubList;
      mockHubGet.mockResolvedValue(mockHub);

      mockHubList.mockResolvedValue(generateMockSchemaList(names, enrich));
    }

    it('should unarchive a content-type-schema by id', async () => {
      const mockGet = jest.fn();
      let mockUnarchive: (() => Promise<ContentTypeSchema>) | undefined;
      const mockHubGet = jest.fn();
      const mockHubList = jest.fn();

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentTypeSchemas: {
          get: mockGet
        },
        hubs: {
          get: mockHubGet
        }
      });

      const plainListContentTypeSchema = {
        id: '1',
        body: '{}',
        schemaId: 'schemaId1'
      };
      const unarchiveResponse = new ContentTypeSchema(plainListContentTypeSchema);

      const mockHub = new Hub();
      mockHub.related.contentTypeSchema.list = mockHubList;
      mockHubGet.mockResolvedValue(mockHub);

      mockHubList.mockResolvedValue(
        generateMockSchemaList(['schemaId1', 'schemaId2'], schema => {
          if (schema.schemaId == 'schemaId1') {
            mockUnarchive = schema.related.unarchive;
          }
        })
      );

      mockGet.mockResolvedValue(unarchiveResponse);

      const argv = {
        ...yargArgs,
        id: 'content-type-schema-id',
        ...config
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalledWith('content-type-schema-id');
      expect(mockUnarchive).toHaveBeenCalled();
    });

    it('should unarchive a content-type-schema by schema id with --schemaId', async () => {
      const targets: (() => Promise<ContentTypeSchema>)[] = [];
      const skips: (() => Promise<ContentTypeSchema>)[] = [];

      injectSchemaMocks(['http://schemas.com/schema1', 'http://schemas.com/schema2'], schema => {
        if (schema.schemaId === 'http://schemas.com/schema2') {
          targets.push(schema.related.unarchive);
        } else {
          skips.push(schema.related.unarchive);
        }
      });

      const argv = {
        ...yargArgs,
        ...config,
        schemaId: 'http://schemas.com/schema2'
      };
      await handler(argv);

      targets.forEach(target => expect(target).toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it('should unarchive content-type-schemas by regex on schema id with --schemaId', async () => {
      const targets: (() => Promise<ContentTypeSchema>)[] = [];
      const skips: (() => Promise<ContentTypeSchema>)[] = [];

      injectSchemaMocks(
        [
          'http://schemas.com/schema1',
          'http://schemas.com/schema2',
          'http://schemas.com/schemaBanana',
          'http://schemas.com/schemaMatch1',
          'http://schemas.com/schemaMatch2'
        ],
        schema => {
          if (schema.schemaId?.indexOf('schemaMatch') !== -1) {
            targets.push(schema.related.unarchive);
          } else {
            skips.push(schema.related.unarchive);
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
        schemaId: '/schemaMatch/'
      };
      await handler(argv);

      targets.forEach(target => expect(target).toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it('should attempt to unarchive all content when no option is provided', async () => {
      const targets: (() => Promise<ContentTypeSchema>)[] = [];

      injectSchemaMocks(
        [
          'http://schemas.com/schema1',
          'http://schemas.com/schema2',
          'http://schemas.com/schemaBanana',
          'http://schemas.com/schemaMatch1',
          'http://schemas.com/schemaMatch2'
        ],
        schema => {
          targets.push(schema.related.unarchive);
        }
      );

      const argv = {
        ...yargArgs,
        ...config
      };
      await handler(argv);

      targets.forEach(target => expect(target).toHaveBeenCalled());
    });

    it('should unarchive content-type-schemas specified in the provided --revertLog', async () => {
      const targets: (() => Promise<ContentTypeSchema>)[] = [];
      const skips: (() => Promise<ContentTypeSchema>)[] = [];

      const logFileName = 'temp/unarchive.log';
      const log =
        '// Schema log test file\n' +
        'ARCHIVE http://schemas.com/schemaMatch1\n' +
        'ARCHIVE http://schemas.com/schemaMatch2';

      const dir = dirname(logFileName);
      if (!(await promisify(exists)(dir))) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);

      injectSchemaMocks(
        [
          'http://schemas.com/schema1',
          'http://schemas.com/schema2',
          'http://schemas.com/schemaBanana',
          'http://schemas.com/schemaMatch1',
          'http://schemas.com/schemaMatch2'
        ],
        schema => {
          if (schema.schemaId?.indexOf('schemaMatch') !== -1) {
            targets.push(schema.related.unarchive);
          } else {
            skips.push(schema.related.unarchive);
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
        revertLog: logFileName
      };
      await handler(argv);

      await promisify(rmdir)('temp', { recursive: true });

      targets.forEach(target => expect(target).toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });
  });
});
