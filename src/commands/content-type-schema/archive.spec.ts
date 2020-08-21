import { builder, command, handler, LOG_FILENAME } from './archive';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentTypeSchema, Hub } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { exists, readFile, unlink, mkdir, writeFile } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';
import readline from 'readline';

jest.mock('readline');

jest.mock('../../services/dynamic-content-client-factory');

describe('content-item-schema archive command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function() {
    expect(command).toEqual('archive [id]');
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
          'The ID of a schema to be archived. Note that this is different from the schema ID - which is in a URL format. If neither this or schemaId are provided, this command will archive ALL content type schemas in the hub.'
      });

      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        describe:
          'The Schema ID of a Content Type Schema to be archived.\nA regex can be provided to select multiple schemas with similar IDs (eg /.header.\\.json/).\nA single --schemaId option may be given to archive a single content type schema.\nMultiple --schemaId options may be given to archive multiple content type schemas at the same time, or even multiple regex.'
      });

      expect(spyOption).toHaveBeenCalledWith('revertLog', {
        type: 'string',
        describe:
          'Path to a log file containing content unarchived in a previous run of the unarchive command.\nWhen provided, archives all schemas listed as unarchived in the log file.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before archiving the found content.'
      });

      expect(spyOption).toHaveBeenCalledWith('s', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, no log file will be produced.'
      });

      expect(spyOption).toHaveBeenCalledWith('ignoreError', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, archive requests that fail will not abort the process.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.'
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
      enrich: (schema: ContentTypeSchema) => void,
      failArchive?: boolean
    ): MockPage<ContentTypeSchema> {
      const contentTypeSchemaResponse: ContentTypeSchema[] = names.map(name => {
        const mockArchive = jest.fn();

        const archiveResponse = new ContentTypeSchema({ schemaId: name });
        archiveResponse.related.archive = mockArchive;

        mockArchive.mockImplementation(() => {
          if (failArchive) {
            throw new Error('Simulated request failure.');
          }
          return Promise.resolve(archiveResponse);
        });

        enrich(archiveResponse);
        return archiveResponse;
      });

      return new MockPage(ContentTypeSchema, contentTypeSchemaResponse);
    }

    function injectSchemaMocks(
      names: string[],
      enrich: (schema: ContentTypeSchema) => void,
      failArchive?: boolean
    ): void {
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

      mockHubList.mockResolvedValue(generateMockSchemaList(names, enrich, failArchive));
    }

    it("should ask if the user wishes to archive the content, and do so when providing 'y'", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const targets: (() => Promise<ContentTypeSchema>)[] = [];
      const skips: (() => Promise<ContentTypeSchema>)[] = [];

      injectSchemaMocks(['http://schemas.com/schema1', 'http://schemas.com/schema2'], schema => {
        if (schema.schemaId === 'http://schemas.com/schema2') {
          targets.push(schema.related.archive);
        } else {
          skips.push(schema.related.archive);
        }
      });

      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        schemaId: 'http://schemas.com/schema2',
        silent: true
      };
      await handler(argv);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(0);

      // Should have archived relevant content, since we said yes.
      targets.forEach(target => expect(target).toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it("should abort when answering 'n' to the question", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['n']);

      const targets: (() => Promise<ContentTypeSchema>)[] = [];
      const skips: (() => Promise<ContentTypeSchema>)[] = [];

      injectSchemaMocks(['http://schemas.com/schema1', 'http://schemas.com/schema2'], schema => {
        if (schema.schemaId === 'http://schemas.com/schema2') {
          targets.push(schema.related.archive);
        } else {
          skips.push(schema.related.archive);
        }
      });

      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        schemaId: 'http://schemas.com/schema2',
        silent: true
      };
      await handler(argv);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(0);

      // No content should have been archived.
      targets.forEach(target => expect(target).not.toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it('should archive without asking if --force is provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['input', 'ignored']);

      const targets: (() => Promise<ContentTypeSchema>)[] = [];
      const skips: (() => Promise<ContentTypeSchema>)[] = [];

      injectSchemaMocks(['http://schemas.com/schema1', 'http://schemas.com/schema2'], schema => {
        if (schema.schemaId === 'http://schemas.com/schema2') {
          targets.push(schema.related.archive);
        } else {
          skips.push(schema.related.archive);
        }
      });

      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        schemaId: 'http://schemas.com/schema2',
        silent: true,
        force: true
      };
      await handler(argv);

      // We expect our mocked responses to still be present, as the user will not be asked to continue.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(2);

      // Should have archived relevant content, since we forced operation.
      targets.forEach(target => expect(target).toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it('should archive a content-type-schema by id', async () => {
      const mockGet = jest.fn();
      const mockArchive = jest.fn();

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentTypeSchemas: {
          get: mockGet
        }
      });
      const plainListContentTypeSchema = {
        id: '1',
        body: '{}',
        schemaId: 'schemaId1'
      };
      const archiveResponse = new ContentTypeSchema(plainListContentTypeSchema);

      archiveResponse.related.archive = mockArchive;
      mockGet.mockResolvedValue(archiveResponse);
      mockArchive.mockResolvedValue(archiveResponse);

      const argv = {
        ...yargArgs,
        id: 'content-type-schema-id',
        ...config,
        logFile: LOG_FILENAME(),
        force: true,
        silent: true
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalledWith('content-type-schema-id');
      expect(mockArchive).toHaveBeenCalled();
    });

    it('should archive a content-type-schema by schema id with --schemaId', async () => {
      const targets: (() => Promise<ContentTypeSchema>)[] = [];
      const skips: (() => Promise<ContentTypeSchema>)[] = [];

      injectSchemaMocks(['http://schemas.com/schema1', 'http://schemas.com/schema2'], schema => {
        if (schema.schemaId === 'http://schemas.com/schema2') {
          targets.push(schema.related.archive);
        } else {
          skips.push(schema.related.archive);
        }
      });

      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        schemaId: 'http://schemas.com/schema2',
        force: true,
        silent: true
      };
      await handler(argv);

      targets.forEach(target => expect(target).toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it('should archive content-type-schemas by regex on schema id with --schemaId', async () => {
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
          if ((schema.schemaId || '').indexOf('schemaMatch') !== -1) {
            targets.push(schema.related.archive);
          } else {
            skips.push(schema.related.archive);
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        schemaId: ['/schemaMatch/'], // Pass as an array to cover that case too.
        force: true,
        silent: true
      };
      await handler(argv);

      targets.forEach(target => expect(target).toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it('should attempt to archive all content when no option is provided', async () => {
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
          targets.push(schema.related.archive);
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        force: true,
        silent: true
      };
      await handler(argv);

      targets.forEach(target => expect(target).toHaveBeenCalled());
    });

    it('should archive content-type-schemas specified in the provided --revertLog', async () => {
      const targets: (() => Promise<ContentTypeSchema>)[] = [];
      const skips: (() => Promise<ContentTypeSchema>)[] = [];

      const logFileName = 'temp/schema-archive-revert.log';
      const log =
        '// Schema log test file\n' +
        'UNARCHIVE http://schemas.com/schemaMatch1\n' +
        'UNARCHIVE http://schemas.com/schemaMatch2\n' +
        'UNARCHIVE http://schemas.com/schemaMissing';

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
          if ((schema.schemaId || '').indexOf('schemaMatch') !== -1) {
            targets.push(schema.related.archive);
          } else {
            skips.push(schema.related.archive);
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        slient: true,
        force: true,
        revertLog: logFileName
      };
      await handler(argv);

      await promisify(unlink)(logFileName);

      targets.forEach(target => expect(target).toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it('should output archived content to a well formatted log file with specified path in --logFile', async () => {
      // First, ensure the log does not already exist.
      if (await promisify(exists)('temp/schema-archive-test.log')) {
        await promisify(unlink)('temp/schema-archive-test.log');
      }

      const targets: string[] = [];

      injectSchemaMocks(
        [
          'http://schemas.com/schema1',
          'http://schemas.com/schema2',
          'http://schemas.com/schemaBanana',
          'http://schemas.com/schemaMatch1',
          'http://schemas.com/schemaMatch2'
        ],
        schema => {
          if ((schema.schemaId || '').indexOf('schemaMatch') !== -1) {
            targets.push(schema.schemaId || '');
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
        logFile: 'temp/schema-archive-test.log',
        schemaId: '/schemaMatch/',
        force: true
      };
      await handler(argv);

      const logExists = await promisify(exists)('temp/schema-archive-test.log');

      expect(logExists).toBeTruthy();

      // Log should contain the two schema that match.

      const log = await promisify(readFile)('temp/schema-archive-test.log', 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      logLines.forEach(line => {
        if (line.startsWith('//')) return;
        const lineSplit = line.split(' ');
        if (lineSplit.length == 2) {
          expect(lineSplit[0]).toEqual('ARCHIVE');
          expect(targets.indexOf(lineSplit[1])).not.toEqual(-1);
          total++;
        }
      });

      expect(total).toEqual(2);

      await promisify(unlink)('temp/schema-archive-test.log');
    });

    it('should report a failed archive in the provided --logFile and exit immediately', async () => {
      // First, ensure the log does not already exist.
      if (await promisify(exists)('temp/schema-archive-failed.log')) {
        await promisify(unlink)('temp/schema-archive-failed.log');
      }

      const targets: string[] = [];

      injectSchemaMocks(
        [
          'http://schemas.com/schema1',
          'http://schemas.com/schema2',
          'http://schemas.com/schemaBanana',
          'http://schemas.com/schemaMatch1',
          'http://schemas.com/schemaMatch2'
        ],
        schema => {
          if ((schema.schemaId || '').indexOf('schemaMatch') !== -1) {
            targets.push(schema.schemaId || '');
          }
        },
        true
      );

      const argv = {
        ...yargArgs,
        ...config,
        logFile: 'temp/schema-archive-failed.log',
        schemaId: '/schemaMatch/',
        force: true
      };
      await handler(argv);

      const logExists = await promisify(exists)('temp/schema-archive-failed.log');

      expect(logExists).toBeTruthy();

      // Log should contain the two schema that match (as failures)

      const log = await promisify(readFile)('temp/schema-archive-failed.log', 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      logLines.forEach(line => {
        if (line.indexOf('ARCHIVE FAILED') !== -1) {
          total++;
        }
      });

      expect(total).toEqual(1); // Does not continue to archive the next one

      await promisify(unlink)('temp/schema-archive-failed.log');
    });

    it('should skip failed archives when --ignoreError is provided, but log all failures', async () => {
      // First, ensure the log does not already exist.
      if (await promisify(exists)('temp/schema-archive-skip.log')) {
        await promisify(unlink)('temp/schema-archive-skip.log');
      }

      const targets: string[] = [];

      injectSchemaMocks(
        [
          'http://schemas.com/schema1',
          'http://schemas.com/schema2',
          'http://schemas.com/schemaBanana',
          'http://schemas.com/schemaMatch1',
          'http://schemas.com/schemaMatch2'
        ],
        schema => {
          if ((schema.schemaId || '').indexOf('schemaMatch') !== -1) {
            targets.push(schema.schemaId || '');
          }
        },
        true
      );

      const argv = {
        ...yargArgs,
        ...config,
        logFile: 'temp/schema-archive-skip.log',
        schemaId: '/schemaMatch/',
        ignoreError: true,
        force: true
      };
      await handler(argv);

      const logExists = await promisify(exists)('temp/schema-archive-skip.log');

      expect(logExists).toBeTruthy();

      // Log should contain the two schema that match (as failures)

      const log = await promisify(readFile)('temp/schema-archive-skip.log', 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      logLines.forEach(line => {
        if (line.indexOf('ARCHIVE FAILED') !== -1) {
          total++;
        }
      });

      expect(total).toEqual(2); // Fails to archive each matching type.

      await promisify(unlink)('temp/schema-archive-skip.log');
    });

    it('should exit cleanly when no content can be archived', async () => {
      injectSchemaMocks([], () => {});

      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        force: true,
        silent: true
      };
      await handler(argv);
    });

    it('should exit cleanly when revert log is missing', async () => {
      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        force: true,
        silent: true,
        revertLog: 'doesntExist.txt'
      };
      await handler(argv);
    });

    it('should exit cleanly when hub is not configured, or on invalid input.', async () => {
      // Content list/get is not init, so it will throw.

      const mockHubGet = jest.fn();

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockHubGet
        }
      });

      const mockHub = new Hub();
      mockHubGet.mockResolvedValue(mockHub);

      // All
      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        force: true,
        silent: true
      };
      await handler(argv);

      // Id
      const argv2 = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        force: true,
        silent: true,
        id: 'test'
      };
      await handler(argv2);

      // Id and Schema id
      const argv3 = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        force: true,
        silent: true,
        id: 'test',
        schemaId: 'conflict'
      };
      await handler(argv3);
    });
  });
});
