import { builder, coerceLog, command, handler, LOG_FILENAME } from './archive';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType, HttpError, Hub } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { exists, readFile, unlink, mkdir, writeFile } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';
import readline from 'readline';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { FileLog, setVersion } from '../../common/file-log';

setVersion('test-ver');

jest.mock('readline');

jest.mock('../../services/dynamic-content-client-factory');

jest.mock('../../common/log-helpers', () => ({
  ...jest.requireActual('../../common/log-helpers'),
  getDefaultLogPath: jest.fn()
}));

describe('content-type archive command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function () {
    expect(command).toEqual('archive [id]');
  });

  describe('builder tests', function () {
    it('should configure yargs', function () {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        type: 'string',
        describe:
          'The ID of a content type to be archived. If neither this or schemaId are provided, this command will archive ALL content types in the hub.'
      });

      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        describe:
          "The Schema ID of a Content Type's Schema to be archived.\nA regex can be provided to select multiple types with similar or matching schema IDs (eg /.header.\\.json/).\nA single --schemaId option may be given to match a single content type schema.\nMultiple --schemaId options may be given to match multiple content type schemas at the same time, or even multiple regex."
      });

      expect(spyOption).toHaveBeenCalledWith('revertLog', {
        type: 'string',
        describe:
          'Path to a log file containing content unarchived in a previous run of the unarchive command.\nWhen provided, archives all types listed as unarchived in the log file.',
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
        describe: 'Path to a log file to write to.',
        coerce: coerceLog
      });
    });

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function () {
      LOG_FILENAME();

      expect(getDefaultLogPath).toHaveBeenCalledWith('type', 'archive', process.platform);
    });

    it('should generate a log with coerceLog with the appropriate title', function () {
      const logFile = coerceLog('filename.log');

      expect(logFile).toEqual(expect.any(FileLog));
      expect(logFile.title).toMatch(/^dc\-cli test\-ver \- Content Type Archive Log \- ./);
    });
  });

  describe('handler tests', function () {
    const yargArgs = {
      $0: 'test',
      _: ['test'],
      json: true
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id',
      logFile: new FileLog()
    };

    function generateMockTypeList(
      templates: { name: string; schemaId: string; id?: string }[],
      enrich: (schema: ContentType) => void,
      failArchive?: boolean
    ): MockPage<ContentType> {
      const contentTypeResponse: ContentType[] = templates.map(template => {
        const mockArchive = jest.fn();

        const archiveResponse = new ContentType({
          settings: { label: template.name },
          contentTypeUri: template.schemaId,
          id: template.id
        });
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

      return new MockPage(ContentType, contentTypeResponse);
    }

    function injectTypeMocks(
      templates: { name: string; schemaId: string; id?: string }[],
      enrich: (schema: ContentType) => void,
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
      mockHub.related.contentTypes.list = mockHubList;
      mockHubGet.mockResolvedValue(mockHub);

      mockHubList.mockResolvedValue(generateMockTypeList(templates, enrich, failArchive));
    }

    it("should ask if the user wishes to archive the content, and do so when providing 'y'", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const targets: (() => Promise<ContentType>)[] = [];
      const skips: (() => Promise<ContentType>)[] = [];

      injectTypeMocks(
        [
          { name: 'Schema 1', schemaId: 'http://schemas.com/schema1' },
          { name: 'Schema 2', schemaId: 'http://schemas.com/schema2' }
        ],
        type => {
          if (type.contentTypeUri === 'http://schemas.com/schema2') {
            targets.push(type.related.archive);
          } else {
            skips.push(type.related.archive);
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
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

      const targets: (() => Promise<ContentType>)[] = [];
      const skips: (() => Promise<ContentType>)[] = [];

      injectTypeMocks(
        [
          { name: 'Schema 1', schemaId: 'http://schemas.com/schema1' },
          { name: 'Schema 2', schemaId: 'http://schemas.com/schema2' }
        ],
        type => {
          if (type.contentTypeUri === 'http://schemas.com/schema2') {
            targets.push(type.related.archive);
          } else {
            skips.push(type.related.archive);
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
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

      const targets: (() => Promise<ContentType>)[] = [];
      const skips: (() => Promise<ContentType>)[] = [];

      injectTypeMocks(
        [
          { name: 'Schema 1', schemaId: 'http://schemas.com/schema1' },
          { name: 'Schema 2', schemaId: 'http://schemas.com/schema2' }
        ],
        type => {
          if (type.contentTypeUri === 'http://schemas.com/schema2') {
            targets.push(type.related.archive);
          } else {
            skips.push(type.related.archive);
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
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

    it('should archive a content-type by id', async () => {
      const mockGet = jest.fn();
      const mockArchive = jest.fn();

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentTypes: {
          get: mockGet
        }
      });
      const plainListContentType = {
        id: 'content-type-id',
        body: '{}',
        contentTypeUri: 'schemaId1'
      };
      const archiveResponse = new ContentType(plainListContentType);

      archiveResponse.related.archive = mockArchive;
      mockGet.mockResolvedValue(archiveResponse);
      mockArchive.mockResolvedValue(archiveResponse);

      const argv = {
        ...yargArgs,
        id: 'content-type-id',
        ...config,
        force: true,
        silent: true
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalledWith('content-type-id');
      expect(mockArchive).toHaveBeenCalled();
    });

    it('should archive a content-type by schema id with --schemaId', async () => {
      const targets: (() => Promise<ContentType>)[] = [];
      const skips: (() => Promise<ContentType>)[] = [];

      injectTypeMocks(
        [
          { name: 'Schema 1', schemaId: 'http://schemas.com/schema1' },
          { name: 'Schema 2', schemaId: 'http://schemas.com/schema2' }
        ],
        type => {
          if (type.contentTypeUri === 'http://schemas.com/schema2') {
            targets.push(type.related.archive);
          } else {
            skips.push(type.related.archive);
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
        schemaId: 'http://schemas.com/schema2',
        force: true,
        silent: true
      };
      await handler(argv);

      targets.forEach(target => expect(target).toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it('should archive content-types by regex on schema id with --schemaId', async () => {
      const targets: (() => Promise<ContentType>)[] = [];
      const skips: (() => Promise<ContentType>)[] = [];

      injectTypeMocks(
        [
          { name: 'Schema 1', schemaId: 'http://schemas.com/schema1' },
          { name: 'Schema 2', schemaId: 'http://schemas.com/schema2' },
          { name: 'Schema Banana', schemaId: 'http://schemas.com/schemaBanana' },
          { name: 'Schema Match 1', schemaId: 'http://schemas.com/schemaMatch1' },
          { name: 'Schema Match 2', schemaId: 'http://schemas.com/schemaMatch2' }
        ],
        type => {
          if ((type.contentTypeUri || '').indexOf('schemaMatch') !== -1) {
            targets.push(type.related.archive);
          } else {
            skips.push(type.related.archive);
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
        schemaId: ['/schemaMatch/'], // Pass as an array to cover that case too.
        force: true,
        silent: true
      };
      await handler(argv);

      targets.forEach(target => expect(target).toHaveBeenCalled());
      skips.forEach(skip => expect(skip).not.toHaveBeenCalled());
    });

    it('should attempt to archive all content when no option is provided', async () => {
      const targets: (() => Promise<ContentType>)[] = [];

      injectTypeMocks(
        [
          { name: 'Schema 1', schemaId: 'http://schemas.com/schema1' },
          { name: 'Schema 2', schemaId: 'http://schemas.com/schema2' },
          { name: 'Schema Banana', schemaId: 'http://schemas.com/schemaBanana' },
          { name: 'Schema Match 1', schemaId: 'http://schemas.com/schemaMatch1' },
          { name: 'Schema Match 2', schemaId: 'http://schemas.com/schemaMatch2' }
        ],
        type => {
          targets.push(type.related.archive);
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
        force: true,
        silent: true
      };
      await handler(argv);

      targets.forEach(target => expect(target).toHaveBeenCalled());
    });

    it('should archive content-types specified in the provided --revertLog', async () => {
      const targets: (() => Promise<ContentType>)[] = [];
      const skips: (() => Promise<ContentType>)[] = [];

      const logFileName = `temp_${process.env.JEST_WORKER_ID}/type-archive-revert.log`;
      const log = '// Type log test file\n' + 'UNARCHIVE id1\n' + 'UNARCHIVE id2\n' + 'UNARCHIVE idMissing';

      const dir = dirname(logFileName);
      if (!(await promisify(exists)(dir))) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);

      injectTypeMocks(
        [
          { name: 'Schema 1', schemaId: 'http://schemas.com/schema1' },
          { name: 'Schema 2', schemaId: 'http://schemas.com/schema2' },
          { name: 'Schema Banana', schemaId: 'http://schemas.com/schemaBanana' },
          { name: 'Schema Match 1', schemaId: 'http://schemas.com/schemaMatch1', id: 'id1' },
          { name: 'Schema Match 2', schemaId: 'http://schemas.com/schemaMatch2', id: 'id2' }
        ],
        type => {
          if ((type.contentTypeUri || '').indexOf('schemaMatch') !== -1) {
            targets.push(type.related.archive);
          } else {
            skips.push(type.related.archive);
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
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
      if (await promisify(exists)(`temp_${process.env.JEST_WORKER_ID}/type-archive-test.log`)) {
        await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/type-archive-test.log`);
      }

      const targets: string[] = [];

      injectTypeMocks(
        [
          { name: 'Schema 1', schemaId: 'http://schemas.com/schema1' },
          { name: 'Schema 2', schemaId: 'http://schemas.com/schema2' },
          { name: 'Schema Banana', schemaId: 'http://schemas.com/schemaBanana' },
          { name: 'Schema Match 1', schemaId: 'http://schemas.com/schemaMatch1', id: 'id1' },
          { name: 'Schema Match 2', schemaId: 'http://schemas.com/schemaMatch2', id: 'id2' }
        ],
        type => {
          if ((type.contentTypeUri || '').indexOf('schemaMatch') !== -1) {
            targets.push(type.id || '');
          }
        }
      );

      const argv = {
        ...yargArgs,
        ...config,
        logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/type-archive-test.log`),
        schemaId: '/schemaMatch/',
        force: true
      };
      await handler(argv);

      const logExists = await promisify(exists)(`temp_${process.env.JEST_WORKER_ID}/type-archive-test.log`);

      expect(logExists).toBeTruthy();

      // Log should contain the two schema that match.

      const log = await promisify(readFile)(`temp_${process.env.JEST_WORKER_ID}/type-archive-test.log`, 'utf8');

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

      await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/type-archive-test.log`);
    });

    it('should report a failed archive in the provided --logFile and exit immediately', async () => {
      // First, ensure the log does not already exist.
      if (await promisify(exists)(`temp_${process.env.JEST_WORKER_ID}/type-archive-failed.log`)) {
        await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/type-archive-failed.log`);
      }

      const targets: string[] = [];

      injectTypeMocks(
        [
          { name: 'Schema 1', schemaId: 'http://schemas.com/schema1' },
          { name: 'Schema 2', schemaId: 'http://schemas.com/schema2' },
          { name: 'Schema Banana', schemaId: 'http://schemas.com/schemaBanana' },
          { name: 'Schema Match 1', schemaId: 'http://schemas.com/schemaMatch1', id: 'id1' },
          { name: 'Schema Match 2', schemaId: 'http://schemas.com/schemaMatch2', id: 'id2' }
        ],
        type => {
          if ((type.contentTypeUri || '').indexOf('schemaMatch') !== -1) {
            targets.push(type.id || '');
          }
        },
        true
      );

      const argv = {
        ...yargArgs,
        ...config,
        logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/type-archive-failed.log`),
        schemaId: '/schemaMatch/',
        force: true
      };
      await handler(argv);

      const logExists = await promisify(exists)(`temp_${process.env.JEST_WORKER_ID}/type-archive-failed.log`);

      expect(logExists).toBeTruthy();

      // Log should contain the two schema that match (as failures)

      const log = await promisify(readFile)(`temp_${process.env.JEST_WORKER_ID}/type-archive-failed.log`, 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      logLines.forEach(line => {
        if (line.indexOf('ARCHIVE FAILED') !== -1) {
          total++;
        }
      });

      expect(total).toEqual(1); // Does not continue to archive the next one

      await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/type-archive-failed.log`);
    });

    it('should skip failed archives when --ignoreError is provided, but log all failures', async () => {
      // First, ensure the log does not already exist.
      if (await promisify(exists)(`temp_${process.env.JEST_WORKER_ID}/type-archive-skip.log`)) {
        await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/type-archive-skip.log`);
      }

      const targets: string[] = [];

      injectTypeMocks(
        [
          { name: 'Schema 1', schemaId: 'http://schemas.com/schema1' },
          { name: 'Schema 2', schemaId: 'http://schemas.com/schema2' },
          { name: 'Schema Banana', schemaId: 'http://schemas.com/schemaBanana' },
          { name: 'Schema Match 1', schemaId: 'http://schemas.com/schemaMatch1', id: 'id1' },
          { name: 'Schema Match 2', schemaId: 'http://schemas.com/schemaMatch2', id: 'id2' }
        ],
        type => {
          if ((type.contentTypeUri || '').indexOf('schemaMatch') !== -1) {
            targets.push(type.id || '');
          }
        },
        true
      );

      const argv = {
        ...yargArgs,
        ...config,
        logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/type-archive-skip.log`),
        schemaId: '/schemaMatch/',
        ignoreError: true,
        force: true
      };
      await handler(argv);

      const logExists = await promisify(exists)(`temp_${process.env.JEST_WORKER_ID}/type-archive-skip.log`);

      expect(logExists).toBeTruthy();

      // Log should contain the two schema that match (as failures)

      const log = await promisify(readFile)(`temp_${process.env.JEST_WORKER_ID}/type-archive-skip.log`, 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      logLines.forEach(line => {
        if (line.indexOf('ARCHIVE FAILED') !== -1) {
          total++;
        }
      });

      expect(total).toEqual(2); // Fails to archive each matching type.

      await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/type-archive-skip.log`);
    });

    it('should exit cleanly when no content can be archived', async () => {
      injectTypeMocks([], () => {
        /* */
      });

      const argv = {
        ...yargArgs,
        ...config,
        force: true,
        silent: true
      };
      await handler(argv);
    });

    it('should throw an error when revert log is missing', async () => {
      const logSpy = jest.spyOn(console, 'log');
      const mockHubGet = jest.fn();
      const mockHubList = jest.fn();

      const mockHub = new Hub();
      mockHubList.mockResolvedValue(
        generateMockTypeList([{ name: 'name', schemaId: 'http://schemas.com/schema1' }], () => {}, false)
      );
      mockHub.related.contentTypes.list = mockHubList;
      mockHubGet.mockResolvedValue(mockHub);

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockHubGet
        }
      });

      const argv = {
        ...yargArgs,
        ...config,
        schemaId: 'http://schemas.com/schema1',
        silent: true,
        revertLog: 'doesntExist.txt'
      };

      await expect(handler(argv)).resolves.toBeUndefined();
      expect(logSpy.mock.lastCall).toEqual(['Fatal error - could not read unarchive log']);
    });

    it('should throw an error when fails to get content type by id', async () => {
      const logSpy = jest.spyOn(console, 'log');
      const mockGet = jest.fn();

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentTypes: {
          get: mockGet
        }
      });

      mockGet.mockRejectedValue(new HttpError('Failed to get content type by id'));

      const argv = {
        ...yargArgs,
        ...config,
        silent: true,
        id: 'test-content-type-id'
      };

      await expect(handler(argv)).resolves.toBeUndefined();
      expect(logSpy.mock.lastCall).toEqual(['Fatal error: could not find content type with ID test-content-type-id']);
    });

    it('should throw an error when fails to get hub by id', async () => {
      const logSpy = jest.spyOn(console, 'log');
      const mockHubGet = jest.fn();

      mockHubGet.mockRejectedValue(new HttpError('Failed to get hub by id'));

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockHubGet
        }
      });

      const argv = {
        ...yargArgs,
        ...config,
        schemaId: 'http://schemas.com/schema1',
        silent: true
      };
      await expect(handler(argv)).resolves.toBeUndefined();
      expect(logSpy.mock.lastCall).toEqual(['Fatal error: could not retrieve content types to archive']);
    });

    it('should throw an error when fails to list hub content types', async () => {
      const logSpy = jest.spyOn(console, 'log');
      const mockHubGet = jest.fn();
      const mockHubList = jest.fn();

      const mockHub = new Hub();
      mockHubList.mockRejectedValue(new HttpError('Failed to list content types'));
      mockHub.related.contentTypes.list = mockHubList;
      mockHubGet.mockResolvedValue(mockHub);

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockHubGet
        }
      });

      const argv = {
        ...yargArgs,
        ...config,
        schemaId: 'http://schemas.com/schema1',
        silent: true
      };
      await expect(handler(argv)).resolves.toBeUndefined();
      expect(logSpy.mock.lastCall).toEqual(['Fatal error: could not retrieve content types to archive']);
    });
  });
});
