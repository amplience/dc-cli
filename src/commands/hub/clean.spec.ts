import { builder, command, handler, LOG_FILENAME, steps } from './clean';
import { CleanHubStepId } from './model/clean-hub-step';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import Yargs from 'yargs/yargs';

import * as content from './steps/content-clean-step';
import * as schema from './steps/schema-clean-step';
import * as type from './steps/type-clean-step';

import rmdir from 'rimraf';
import { ConfigurationParameters } from '../configure';
import { Arguments } from 'yargs';
import { FileLog } from '../../common/file-log';
import { CleanHubBuilderOptions } from '../../interfaces/clean-hub-builder-options';

jest.mock('readline');

jest.mock('../../services/dynamic-content-client-factory');

let success = [true, true, true, true];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function succeedOrFail(mock: any, succeed: () => boolean): jest.Mock {
  mock.mockImplementation(() => Promise.resolve(succeed()));
  return mock;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockStep(name: string, id: string, success: () => boolean): any {
  return jest.fn().mockImplementation(() => ({
    run: succeedOrFail(jest.fn(), success),
    revert: succeedOrFail(jest.fn(), success),
    getName: jest.fn().mockReturnValue(name),
    getId: jest.fn().mockReturnValue(id)
  }));
}

jest.mock('./steps/content-clean-step', () => ({
  ContentCleanStep: mockStep('Clean Content', 'content', () => success[0])
}));

jest.mock('./steps/type-clean-step', () => ({
  TypeCleanStep: mockStep('Clean Content Types', 'type', () => success[1])
}));

jest.mock('./steps/schema-clean-step', () => ({
  SchemaCleanStep: mockStep('Clean Content Type Schemas', 'schema', () => success[2])
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
  return [content.ContentCleanStep as jest.Mock, type.TypeCleanStep as jest.Mock, schema.SchemaCleanStep as jest.Mock];
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

describe('hub clean command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function () {
    expect(command).toEqual('clean');
  });

  it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function () {
    LOG_FILENAME();

    expect(getDefaultLogPath).toHaveBeenCalledWith('hub', 'clean', process.platform);
  });

  describe('builder tests', function () {
    it('should configure yargs', function () {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).not.toHaveBeenCalled();

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe:
          'Overwrite content, create and assign content types, and ignore content with missing types/references without asking.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: createLog
      });

      expect(spyOption).toHaveBeenCalledWith('step', {
        type: 'string',
        describe: 'Start at a specific step. Steps after the one you specify will also run.',
        choices: steps.map(step => step.getId())
      });

      expect(spyOption).toHaveBeenCalledWith('ignoreSchemaValidation', {
        type: 'boolean',
        boolean: false,
        describe: 'Ignore content item schema validation during clean'
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
      hubId: 'hub-id'
    };

    beforeAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/clean/`);
    });

    afterAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/clean/`);
    });

    it('should call all steps in order with given parameters', async () => {
      clearMocks();
      success = [true, true, true, true];

      const argv: Arguments<CleanHubBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clean/steps/all.log`),
        force: true,
        ignoreSchemaValidation: true
      };

      await handler(argv);

      argv.logFile = expect.any(FileLog);

      const mocks = getMocks();

      mocks.forEach(mock => {
        const instance = mock.mock.results[0].value;

        expect(instance.run).toHaveBeenCalledWith(argv);
      });

      const loadLog = new FileLog();
      await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clean/steps/all.log`);
    });

    it('should handle false returns from each of the steps by stopping the process', async () => {
      for (let i = 0; i < 3; i++) {
        clearMocks();
        success = [i != 0, i != 1, i != 2];

        const argv: Arguments<CleanHubBuilderOptions & ConfigurationParameters> = {
          ...yargArgs,
          ...config,

          logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clean/steps/fail` + i + '.log'),
          force: true
        };

        await handler(argv);

        const mocks = getMocks();

        mocks.forEach((mock, index) => {
          const instance = mock.mock.results[0].value;

          if (index > i) {
            expect(instance.run).not.toHaveBeenCalled();
          } else {
            expect(instance.run).toHaveBeenCalledWith(argv);
          }
        });

        const loadLog = new FileLog();
        await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clean/steps/fail` + i + '.log');
      }
    });

    it('should start from the step given as a parameter', async () => {
      for (let i = 0; i < 3; i++) {
        clearMocks();
        success = [true, true, true];

        const argv: Arguments<CleanHubBuilderOptions & ConfigurationParameters> = {
          ...yargArgs,
          ...config,

          step: steps[i].getId(),
          logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/clean/steps/step` + i + '.log'),
          force: true
        };

        await handler(argv);

        const mocks = getMocks();

        mocks.forEach((mock, index) => {
          const instance = mock.mock.results[0].value;

          if (index < i) {
            expect(instance.run).not.toHaveBeenCalled();
          } else {
            expect(instance.run).toHaveBeenCalledWith(argv);
          }
        });

        const loadLog = new FileLog();
        await loadLog.loadFromFile(`temp_${process.env.JEST_WORKER_ID}/clean/steps/step` + i + '.log');
      }
    });

    it('should only have one of each type of step', () => {
      const stepsSoFar = new Set<CleanHubStepId>();

      for (const step of steps) {
        const id = step.getId();

        expect(stepsSoFar.has(id)).toBeFalsy();

        stepsSoFar.add(id);
      }
    });
  });
});
