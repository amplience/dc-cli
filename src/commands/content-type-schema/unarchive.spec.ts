import { builder, command, handler, LOG_FILENAME } from './unarchive';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentTypeSchema, Hub } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { dirname } from 'path';
import { exists, writeFile, mkdir, readFile, unlink } from 'fs';
import { promisify } from 'util';
import readline from 'readline';

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

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before unarchiving the found content.'
      });

      expect(spyOption).toHaveBeenCalledWith('s', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, no log file will be produced.'
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
      failUnarchive?: boolean
    ): MockPage<ContentTypeSchema> {
      const contentTypeSchemaResponse: ContentTypeSchema[] = names.map(name => {
        const mockUnarchive = jest.fn();

        const unarchiveResponse = new ContentTypeSchema({ schemaId: name });
        unarchiveResponse.related.unarchive = mockUnarchive;

        mockUnarchive.mockImplementation(() => {
          if (failUnarchive) {
            throw new Error('Simulated request failure.');
          }
          return Promise.resolve(unarchiveResponse);
        });

        enrich(unarchiveResponse);
        return unarchiveResponse;
      });

      return new MockPage(ContentTypeSchema, contentTypeSchemaResponse);
    }

    function injectSchemaMocks(
      names: string[],
      enrich: (schema: ContentTypeSchema) => void,
      failUnarchive?: boolean
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

      mockHubList.mockResolvedValue(generateMockSchemaList(names, enrich, failUnarchive));
    }

    it("should ask if the user wishes to unarchive the content, and do so when providing 'y'", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

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
        logFile: LOG_FILENAME(),
        schemaId: 'http://schemas.com/schema2',
        silent: true
      };
      await handler(argv);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(0);

      // Should have unarchived relevant content, since we said yes.
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
          targets.push(schema.related.unarchive);
        } else {
          skips.push(schema.related.unarchive);
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

      // No content should have been unarchived.
      targets.forEach(target => expect(target).not.toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it('should unarchive without asking if --force is provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['input', 'ignored']);

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
        logFile: LOG_FILENAME(),
        schemaId: 'http://schemas.com/schema2',
        silent: true,
        force: true
      };
      await handler(argv);

      // We expect our mocked responses to still be present, as the user will not be asked to continue.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(2);

      // Should have unarchived relevant content, since we forced operation.
      targets.forEach(target => expect(target).toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it('should unarchive a content-type-schema by id', async () => {
      const mockGet = jest.fn();
      const mockUnarchive = jest.fn();

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
      const unarchiveResponse = new ContentTypeSchema(plainListContentTypeSchema);

      unarchiveResponse.related.unarchive = mockUnarchive;
      mockGet.mockResolvedValue(unarchiveResponse);
      mockUnarchive.mockResolvedValue(unarchiveResponse);

      const argv = {
        ...yargArgs,
        id: 'content-type-schema-id',
        logFile: LOG_FILENAME(),
        slient: true,
        force: true,
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
        logFile: LOG_FILENAME(),
        slient: true,
        force: true,
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
          if ((schema.schemaId || '').indexOf('schemaMatch') !== -1) {
            targets.push(schema.related.unarchive);
          } else {
            skips.push(schema.related.unarchive);
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        slient: true,
        force: true,
        schemaId: ['/schemaMatch/'] // Pass as an array to cover that case too.
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
        ...config,
        logFile: LOG_FILENAME(),
        slient: true,
        force: true
      };
      await handler(argv);

      targets.forEach(target => expect(target).toHaveBeenCalled());
    });

    it('should unarchive content-type-schemas specified in the provided --revertLog', async () => {
      const targets: (() => Promise<ContentTypeSchema>)[] = [];
      const skips: (() => Promise<ContentTypeSchema>)[] = [];

      const logFileName = 'temp/schema-unarchive-revert.log';
      const log =
        '// Schema log test file\n' +
        'ARCHIVE http://schemas.com/schemaMatch1\n' +
        'ARCHIVE http://schemas.com/schemaMatch2\n' +
        'ARCHIVE http://schemas.com/missing';

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
            targets.push(schema.related.unarchive);
          } else {
            skips.push(schema.related.unarchive);
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
      const logFileName = 'temp/type-unarchive-test.log';

      // First, ensure the log does not already exist.
      if (await promisify(exists)(logFileName)) {
        await promisify(unlink)(logFileName);
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
        logFile: logFileName,
        schemaId: '/schemaMatch/',
        force: true
      };
      await handler(argv);

      const logExists = await promisify(exists)(logFileName);

      expect(logExists).toBeTruthy();

      // Log should contain the two schema that match.

      const log = await promisify(readFile)(logFileName, 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      logLines.forEach(line => {
        if (line.startsWith('//')) return;
        const lineSplit = line.split(' ');
        if (lineSplit.length == 2) {
          expect(lineSplit[0]).toEqual('UNARCHIVE');
          expect(targets.indexOf(lineSplit[1])).not.toEqual(-1);
          total++;
        }
      });

      expect(total).toEqual(2);

      await promisify(unlink)(logFileName);
    });

    it('should report a failed unarchive in the provided --logFile and exit immediately', async () => {
      // First, ensure the log does not already exist.
      if (await promisify(exists)('temp/schema-unarchive-failed.log')) {
        await promisify(unlink)('temp/schema-unarchive-failed.log');
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
        logFile: 'temp/schema-unarchive-failed.log',
        schemaId: '/schemaMatch/',
        force: true
      };
      await handler(argv);

      const logExists = await promisify(exists)('temp/schema-unarchive-failed.log');

      expect(logExists).toBeTruthy();

      // Log should contain the two schema that match (as failures)

      const log = await promisify(readFile)('temp/schema-unarchive-failed.log', 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      logLines.forEach(line => {
        if (line.indexOf('UNARCHIVE FAILED') !== -1) {
          total++;
        }
      });

      expect(total).toEqual(1); // Does not continue to archive the next one

      await promisify(unlink)('temp/schema-unarchive-failed.log');
    });

    it('should skip failed unarchives when --ignoreError is provided, but log all failures', async () => {
      // First, ensure the log does not already exist.
      if (await promisify(exists)('temp/schema-unarchive-skip.log')) {
        await promisify(unlink)('temp/schema-unarchive-skip.log');
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
        logFile: 'temp/schema-unarchive-skip.log',
        schemaId: '/schemaMatch/',
        ignoreError: true,
        force: true
      };
      await handler(argv);

      const logExists = await promisify(exists)('temp/schema-unarchive-skip.log');

      expect(logExists).toBeTruthy();

      // Log should contain the two schema that match (as failures)

      const log = await promisify(readFile)('temp/schema-unarchive-skip.log', 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      logLines.forEach(line => {
        if (line.indexOf('UNARCHIVE FAILED') !== -1) {
          total++;
        }
      });

      expect(total).toEqual(2); // Fails to archive each matching type.

      await promisify(unlink)('temp/schema-unarchive-skip.log');
    });

    it('should exit cleanly when no content can be unarchived', async () => {
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
