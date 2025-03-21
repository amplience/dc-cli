import { builder, command, handler, LOG_FILENAME, getDefaultMappingPath, steps } from './clone';
import { createLog, getDefaultLogPath, openRevertLog } from '../../common/log-helpers';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import Yargs from 'yargs/yargs';

import * as content from './steps/content-clone-step';
import * as settings from './steps/settings-clone-step';
import * as schema from './steps/schema-clone-step';
import * as type from './steps/type-clone-step';
import * as extension from './steps/extension-clone-step';
import * as index from './steps/index-clone-step';
import * as event from './steps/event-clone-step';

import rmdir from 'rimraf';
import { CloneHubBuilderOptions } from '../../interfaces/clone-hub-builder-options';
import { ConfigurationParameters } from '../configure';
import { Arguments } from 'yargs';
import { FileLog } from '../../common/file-log';
import { CloneHubState } from './model/clone-hub-state';
import { CloneHubStepId } from './model/clone-hub-step';

jest.mock('readline');

jest.mock('../../services/dynamic-content-client-factory');

let success = [true, true, true, true, true, true, true];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function succeedOrFail(mock: any, succeed: () => boolean): jest.Mock {
  mock.mockImplementation(() => Promise.resolve(succeed()));
  return mock;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockStep(name: string, id: string, success: () => boolean, isLimited?: boolean): any {
  return jest.fn().mockImplementation(() => ({
    run: succeedOrFail(jest.fn(), success),
    revert: succeedOrFail(jest.fn(), success),
    getName: jest.fn().mockReturnValue(name),
    getId: jest.fn().mockReturnValue(id),
    isLimited
  }));
}

jest.mock('./steps/settings-clone-step', () => ({
  SettingsCloneStep: mockStep('Clone Settings', 'settings', () => success[0])
}));

jest.mock('./steps/extension-clone-step', () => ({
  ExtensionCloneStep: mockStep('Clone Extensions', 'extension', () => success[1])
}));

jest.mock('./steps/schema-clone-step', () => ({
  SchemaCloneStep: mockStep('Clone Content Type Schemas', 'schemas', () => success[2])
}));

jest.mock('./steps/type-clone-step', () => ({
  TypeCloneStep: mockStep('Clone Content Types', 'types', () => success[3])
}));

jest.mock('./steps/index-clone-step', () => ({
  IndexCloneStep: mockStep('Clone Indexes', 'index', () => success[4])
}));

jest.mock('./steps/content-clone-step', () => ({
  ContentCloneStep: mockStep('Clone Content', 'content', () => success[5])
}));

jest.mock('./steps/event-clone-step', () => ({
  EventCloneStep: mockStep('Clone Event', 'event', () => success[6], true)
}));

jest.mock('../../common/log-helpers', () => ({
  ...jest.requireActual('../../common/log-helpers'),
  getDefaultLogPath: jest.fn()
}));

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

function getMocks(): jest.Mock[] {
  return [
    settings.SettingsCloneStep as jest.Mock,
    extension.ExtensionCloneStep as jest.Mock,
    schema.SchemaCloneStep as jest.Mock,
    type.TypeCloneStep as jest.Mock,
    index.IndexCloneStep as jest.Mock,
    content.ContentCloneStep as jest.Mock,
    event.EventCloneStep as jest.Mock
  ];
}

function clearMocks(): void {
  const mocks = getMocks();

  mocks.forEach(mock => {
    mock.mock.results.forEach(obj => {
      const instance = obj.value;
      (instance.run as jest.Mock).mockClear();
      (instance.revert as jest.Mock).mockClear();
    });
  });
}

describe('hub clone command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function () {
    expect(command).toEqual('clone <dir>');
  });

  it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function () {
    LOG_FILENAME();

    expect(getDefaultLogPath).toHaveBeenCalledWith('hub', 'clone', process.platform);
  });

  it('should generate a default mapping path containing the given name', function () {
    expect(getDefaultMappingPath('hub-1').indexOf('hub-1')).not.toEqual(-1);
  });

  describe('builder tests', function () {
    it('should configure yargs', function () {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe:
          'Directory to export content to, then import from. This must be set to the previous directory for a revert.',
        type: 'string'
      });

      const commandOptions = spyOptions.mock.calls[1][0];

      expect(commandOptions.acceptSnapshotLimits).toEqual({
        type: 'boolean',
        boolean: true,
        describe:
          'Must be passed to use the event clone step. Only use this argument if you fully understand its limitations.'
      });

      expect(commandOptions.dstHubId).toEqual({
        type: 'string',
        describe: 'Destination hub ID. If not specified, it will be the same as the source.'
      });

      expect(commandOptions.dstClientId).toEqual({
        type: 'string',
        describe: "Destination account's client ID. If not specified, it will be the same as the source."
      });

      expect(commandOptions.dstSecret).toEqual({
        type: 'string',
        describe: "Destination account's secret. Must be used alongside dstClientId."
      });

      expect(commandOptions.mapFile).toEqual({
        type: 'string',
        describe:
          'Mapping file to use when updating content that already exists. Updated with any new mappings that are generated. If not present, will be created.'
      });

      expect(commandOptions.force).toEqual({
        type: 'boolean',
        boolean: true,
        describe:
          'Overwrite content, create and assign content types, and ignore content with missing types/references without asking.',
        alias: 'f'
      });

      expect(commandOptions.validate).toEqual({
        type: 'boolean',
        boolean: true,
        describe: 'Only recreate folder structure - content is validated but not imported.',
        alias: 'v'
      });

      expect(commandOptions.skipIncomplete).toEqual({
        type: 'boolean',
        boolean: true,
        describe: 'Skip any content item that has one or more missing dependancy.'
      });

      expect(commandOptions.lastPublish).toEqual({
        type: 'boolean',
        boolean: true,
        describe: 'When available, export the last published version of a content item rather than its newest version.'
      });

      expect(commandOptions.publish).toEqual({
        type: 'boolean',
        boolean: true,
        describe:
          'Publish any content items that either made a new version on import, or were published more recently in the JSON.'
      });

      expect(commandOptions.republish).toEqual({
        type: 'boolean',
        boolean: true,
        describe:
          'Republish content items regardless of whether the import changed them or not. (--publish not required)'
      });

      expect(commandOptions.excludeKeys).toEqual({
        type: 'boolean',
        boolean: true,
        describe: 'Exclude delivery keys when importing content items.'
      });

      expect(commandOptions.media).toEqual({
        type: 'boolean',
        boolean: true,
        describe:
          "Detect and rewrite media links to match assets in the target account's DAM. Your client must have DAM permissions configured."
      });

      expect(commandOptions.revertLog).toEqual({
        type: 'string',
        describe:
          'Revert a previous clone using a given revert log and given directory. Reverts steps in reverse order, starting at the specified one.',
        coerce: openRevertLog
      });

      expect(commandOptions.logFile).toEqual({
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: createLog
      });

      expect(commandOptions.step).toEqual({
        type: 'string',
        describe: 'Start at a specific step. Steps after the one you specify will also run.',
        choices: steps.map(step => step.getId())
      });

      expect(commandOptions.ignoreSchemaValidation).toEqual({
        type: 'boolean',
        boolean: false,
        describe: 'Ignore content item schema validation during clone'
      });
    });
  });

  describe('handler tests', function () {
    const yargArgs = {
      $0: 'test',
      _: ['test']
    };

    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id',
      acceptSnapshotLimits: true,

      revertLog: Promise.resolve(undefined)
    };

    beforeAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/clone/`);
    });

    afterAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/clone/`);
    });

    function makeState(argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters>): CloneHubState {
      return {
        argv: argv,
        from: {
          clientId: argv.clientId as string,
          clientSecret: argv.clientSecret as string,
          hubId: argv.hubId as string,
          ...yargArgs
        },
        to: {
          clientId: argv.dstClientId as string,
          clientSecret: argv.dstSecret as string,
          hubId: argv.dstHubId as string,
          ...yargArgs
        },
        path: argv.dir,
        logFile: expect.any(FileLog)
      };
    }

    it('should call all steps in order with given parameters', async () => {
      clearMocks();
      success = [true, true, true, true, true, true, true];

      const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        dir: `temp_${process.env.JEST_WORKER_ID}/clone/steps`,

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',
        logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clone/steps/all.log`),

        force: false,
        validate: false,
        skipIncomplete: false,
        media: true,
        ignoreSchemaValidation: true
      };

      const stepConfig = makeState(argv);

      await handler(argv);

      stepConfig.argv.mapFile = expect.any(String);

      const mocks = getMocks();

      mocks.forEach(mock => {
        const instance = mock.mock.results[0].value;

        expect(instance.run).toHaveBeenCalledWith(stepConfig);
      });

      const loadLog = new FileLog();
      await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clone/steps/all.log`);
    });

    it('should handle false returns from each of the steps by stopping the process', async () => {
      for (let i = 0; i < 7; i++) {
        clearMocks();
        success = [i != 0, i != 1, i != 2, i != 3, i != 4, i != 5, i != 6];

        const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
          ...yargArgs,
          ...config,

          dir: `temp_${process.env.JEST_WORKER_ID}/clone/steps`,

          dstHubId: 'hub2-id',
          dstClientId: 'acc2-id',
          dstSecret: 'acc2-secret',
          logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clone/steps/fail` + i + '.log'),

          mapFile: `temp_${process.env.JEST_WORKER_ID}/clone/steps/fail` + i + '.json',
          force: false,
          validate: false,
          skipIncomplete: false,
          media: true
        };

        const stepConfig = makeState(argv);

        await handler(argv);

        const mocks = getMocks();

        mocks.forEach((mock, index) => {
          const instance = mock.mock.results[0].value;

          if (index > i) {
            expect(instance.run).not.toHaveBeenCalled();
          } else {
            expect(instance.run).toHaveBeenCalledWith(stepConfig);
          }
        });

        const loadLog = new FileLog();
        await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clone/steps/fail` + i + '.log');
      }
    });

    it('should start from the step given as a parameter', async () => {
      for (let i = 0; i < 7; i++) {
        clearMocks();
        success = [true, true, true, true, true, true, true];

        const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
          ...yargArgs,
          ...config,

          step: steps[i].getId(),

          dir: `temp_${process.env.JEST_WORKER_ID}/clone/steps`,

          dstHubId: 'hub2-id',
          dstClientId: 'acc2-id',
          dstSecret: 'acc2-secret',
          logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clone/steps/step` + i + '.log'),

          mapFile: `temp_${process.env.JEST_WORKER_ID}/clone/steps/step` + i + '.json',
          force: false,
          validate: false,
          skipIncomplete: false,
          media: true
        };

        const stepConfig = makeState(argv);

        await handler(argv);

        const mocks = getMocks();

        mocks.forEach((mock, index) => {
          const instance = mock.mock.results[0].value;

          if (index < i) {
            expect(instance.run).not.toHaveBeenCalled();
          } else {
            expect(instance.run).toHaveBeenCalledWith(stepConfig);
          }
        });

        const loadLog = new FileLog();
        await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clone/steps/step` + i + '.log');
      }
    });

    it('should exclude acceptSnapshotLimits steps if acceptSnapshotLimits is false', async () => {
      clearMocks();
      success = [true, true, true, true, true, true, true];

      const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,
        acceptSnapshotLimits: false,

        dir: `temp_${process.env.JEST_WORKER_ID}/clone/steps`,

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',
        logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clone/steps/all.log`),

        force: false,
        validate: false,
        skipIncomplete: false,
        media: true
      };

      const stepConfig = makeState(argv);

      await handler(argv);

      stepConfig.argv.mapFile = expect.any(String);

      const mocks = getMocks();

      mocks.forEach(mock => {
        const instance = mock.mock.results[0].value;

        if (instance.isLimited) {
          expect(instance.run).not.toHaveBeenCalled();
        } else {
          expect(instance.run).toHaveBeenCalledWith(stepConfig);
        }
      });

      const loadLog = new FileLog();
      await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clone/steps/all.log`);
    });

    it('should only have one of each type of step', () => {
      const stepsSoFar = new Set<CloneHubStepId>();

      for (const step of steps) {
        const id = step.getId();

        expect(stepsSoFar.has(id)).toBeFalsy();

        stepsSoFar.add(id);
      }
    });
  });

  describe('revert tests', function () {
    const yargArgs = {
      $0: 'test',
      _: ['test']
    };

    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id',
      acceptSnapshotLimits: true
    };

    beforeAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/clone-revert/`);
    });

    afterAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/clone-revert/`);
    });

    async function prepareFakeLog(path: string): Promise<void> {
      const fakeLog = new FileLog(path);
      fakeLog.switchGroup('Clone Content Types');
      fakeLog.addAction('CREATE', 'type');
      fakeLog.addAction('UPDATE', 'type2 0 1');
      fakeLog.switchGroup('Clone Content Type Schema');
      fakeLog.addAction('CREATE', 'type');
      fakeLog.addAction('UPDATE', 'type2 0 1');
      await fakeLog.close();
    }

    function makeState(argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters>): CloneHubState {
      return {
        argv: argv,
        from: {
          clientId: argv.clientId as string,
          clientSecret: argv.clientSecret as string,
          hubId: argv.hubId as string,
          ...yargArgs
        },
        to: {
          clientId: argv.dstClientId as string,
          clientSecret: argv.dstSecret as string,
          hubId: argv.dstHubId as string,
          ...yargArgs
        },
        path: argv.dir,
        logFile: expect.any(FileLog),
        revertLog: expect.any(FileLog)
      };
    }

    it('should revert all steps in order with given parameters', async () => {
      clearMocks();
      success = [true, true, true, true, true, true, true];
      await ensureDirectoryExists(`temp_${process.env.JEST_WORKER_ID}/clone-revert/`);
      await prepareFakeLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/steps.log`);

      const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        dir: `temp_${process.env.JEST_WORKER_ID}/clone-revert/steps`,

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',
        logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/steps/all.log`),
        revertLog: openRevertLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/steps.log`),

        mapFile: `temp_${process.env.JEST_WORKER_ID}/clone-revert/steps/all.json`,
        force: false,
        validate: false,
        skipIncomplete: false,
        media: true
      };

      const stepConfig = makeState(argv);

      await handler(argv);

      const mocks = getMocks();

      mocks.forEach(mock => {
        const instance = mock.mock.results[0].value;

        expect(instance.revert).toHaveBeenCalledWith(stepConfig);
      });

      const loadLog = new FileLog();
      await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clone-revert/steps/all.log`);
    });

    it('should handle exceptions from each of the revert steps by stopping the process', async () => {
      for (let i = 0; i < 7; i++) {
        clearMocks();
        success = [i != 0, i != 1, i != 2, i != 3, i != 4, i != 5, i != 6];

        await ensureDirectoryExists(`temp_${process.env.JEST_WORKER_ID}/clone-revert/`);
        await prepareFakeLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/fail.log`);

        const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
          ...yargArgs,
          ...config,

          dir: `temp_${process.env.JEST_WORKER_ID}/clone-revert/fail`,

          dstHubId: 'hub2-id',
          dstClientId: 'acc2-id',
          dstSecret: 'acc2-secret',
          logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/fail/fail` + i + '.log'),
          revertLog: openRevertLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/fail.log`),

          mapFile: `temp_${process.env.JEST_WORKER_ID}/clone-revert/fail/fail` + i + '.json',
          force: false,
          validate: false,
          skipIncomplete: false,
          media: true
        };

        const stepConfig = makeState(argv);

        await handler(argv);

        const mocks = getMocks();

        mocks.forEach((mock, index) => {
          const instance = mock.mock.results[0].value;

          if (index > i) {
            expect(instance.revert).not.toHaveBeenCalled();
          } else {
            expect(instance.revert).toHaveBeenCalledWith(stepConfig);
          }
        });

        const loadLog = new FileLog();
        await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clone-revert/fail/fail` + i + '.log');
      }
    });

    it('should exit early if revert log cannot be read', async () => {
      clearMocks();
      success = [true, true, true, true, true, true, true];
      await ensureDirectoryExists(`temp_${process.env.JEST_WORKER_ID}/clone-revert/`);

      const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        dir: `temp_${process.env.JEST_WORKER_ID}/clone-revert/steps`,

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',
        logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/steps/early.log`),
        revertLog: openRevertLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/missing.log`),

        mapFile: `temp_${process.env.JEST_WORKER_ID}/clone-revert/steps/all.json`,
        force: false,
        validate: false,
        skipIncomplete: false,
        media: true
      };

      await handler(argv);

      const mocks = getMocks();

      mocks.forEach(mock => {
        const instance = mock.mock.results[0].value;

        expect(instance.revert).not.toHaveBeenCalled();
      });

      const loadLog = new FileLog();
      await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clone-revert/steps/early.log`);
    });

    it('should start reverting from the step given as a parameter (steps in decreasing order)', async () => {
      for (let i = 0; i < 7; i++) {
        clearMocks();
        success = [true, true, true, true, true, true, true];

        await ensureDirectoryExists(`temp_${process.env.JEST_WORKER_ID}/clone-revert/`);
        await prepareFakeLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/step.log`);

        const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
          ...yargArgs,
          ...config,

          step: steps[i].getId(),

          dir: `temp_${process.env.JEST_WORKER_ID}/clone-revert/step`,

          dstHubId: 'hub2-id',
          dstClientId: 'acc2-id',
          dstSecret: 'acc2-secret',
          logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/step/step` + i + '.log'),
          revertLog: openRevertLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/step.log`),

          mapFile: `temp_${process.env.JEST_WORKER_ID}/clone-revert/step/step` + i + '.json',
          force: false,
          validate: false,
          skipIncomplete: false,
          media: true
        };

        const stepConfig = makeState(argv);

        await handler(argv);

        const mocks = getMocks();

        mocks.forEach((mock, index) => {
          const instance = mock.mock.results[0].value;

          if (index < i) {
            expect(instance.revert).not.toHaveBeenCalled();
          } else {
            expect(instance.revert).toHaveBeenCalledWith(stepConfig);
          }
        });

        const loadLog = new FileLog();
        await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clone-revert/step/step` + i + '.log');
      }
    });

    it('should exclude acceptSnapshotLimits steps if acceptSnapshotLimits is false', async () => {
      clearMocks();
      success = [true, true, true, true, true, true, true];
      await ensureDirectoryExists(`temp_${process.env.JEST_WORKER_ID}/clone-revert/`);
      await prepareFakeLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/steps.log`);

      const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,
        acceptSnapshotLimits: false,

        dir: `temp_${process.env.JEST_WORKER_ID}/clone-revert/steps`,

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',
        logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/steps/all.log`),
        revertLog: openRevertLog(`temp_${process.env.JEST_WORKER_ID}/clone-revert/steps.log`),

        mapFile: `temp_${process.env.JEST_WORKER_ID}/clone-revert/steps/all.json`,
        force: false,
        validate: false,
        skipIncomplete: false,
        media: true
      };

      const stepConfig = makeState(argv);

      await handler(argv);

      const mocks = getMocks();

      mocks.forEach(mock => {
        const instance = mock.mock.results[0].value;

        if (instance.isLimited) {
          expect(instance.revert).not.toHaveBeenCalled();
        } else {
          expect(instance.revert).toHaveBeenCalledWith(stepConfig);
        }
      });

      const loadLog = new FileLog();
      await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clone-revert/steps/all.log`);
    });
  });
});
