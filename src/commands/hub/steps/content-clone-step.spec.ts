import { Arguments } from 'yargs';
import { FileLog } from '../../../common/file-log';
import { CloneHubBuilderOptions } from '../../../interfaces/clone-hub-builder-options';
import { ConfigurationParameters } from '../../configure';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';

import * as copy from '../../content-item/copy';

import { ContentCloneStep } from './content-clone-step';
import { CopyItemBuilderOptions } from '../../../interfaces/copy-item-builder-options.interface';

jest.mock('../../../services/dynamic-content-client-factory');
jest.mock('../../content-item/copy');

describe('content clone step', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let copierAny: any;

  const yargArgs = {
    $0: 'test',
    _: ['test']
  };

  const config = {
    clientId: 'client-id',
    clientSecret: 'client-id',
    hubId: 'hub-id'
  };

  function reset(): void {
    jest.resetAllMocks();

    copierAny = copy;
  }

  beforeEach(async () => {
    reset();
  });

  function generateState(directory: string, logName: string): CloneHubState {
    const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
      ...yargArgs,
      ...config,

      dir: directory,

      dstHubId: 'hub2-id',
      dstClientId: 'acc2-id',
      dstSecret: 'acc2-secret'
    };

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
      path: directory,
      logFile: new FileLog(join(directory, logName + '.log'))
    };
  }

  it('should have the name "Clone Content"', () => {
    const step = new ContentCloneStep();
    expect(step.getName()).toEqual('Clone Content');
  });

  it('should call the copy command with arguments from the state', async () => {
    const state = generateState('temp/clone-content/run/', 'run');

    const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;
    copyCalls.splice(0, copyCalls.length);
    copierAny.setForceFail(false);

    const step = new ContentCloneStep();
    const result = await step.run(state);

    expect(copyCalls).toEqual([
      {
        ...state.argv,
        dir: join(state.path, 'content'),
        logFile: state.logFile,
        revertLog: state.revertLog
      }
    ]);

    expect(result).toBeTruthy();
  });

  it('should return false when the copy command fails', async () => {
    const state = generateState('temp/clone-content/fail/', 'fail');

    const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;
    copyCalls.splice(0, copyCalls.length);
    copierAny.setForceFail(true);

    const step = new ContentCloneStep();
    const result = await step.run(state);

    expect(copyCalls.length).toEqual(1);
    expect(result).toBeFalsy();
  });

  it('should call the copy revert command with arguments from the state', async () => {
    const state = generateState('temp/clone-content/run/', 'run');
    state.revertLog = new FileLog();

    const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;
    copyCalls.splice(0, copyCalls.length);
    copierAny.setForceFail(false);

    const step = new ContentCloneStep();
    const result = await step.revert(state);

    expect(copyCalls).toEqual([
      {
        ...state.argv,
        dir: join(state.path, 'content'),
        logFile: state.logFile,
        revertLog: state.revertLog
      }
    ]);

    expect(result).toBeTruthy();
  });

  it('should return false when the copy revert command fails', async () => {
    const state = generateState('temp/clone-content/fail/', 'fail');
    state.revertLog = new FileLog();

    const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;
    copyCalls.splice(0, copyCalls.length);
    copierAny.setForceFail(true);

    const step = new ContentCloneStep();
    const result = await step.revert(state);

    expect(copyCalls.length).toEqual(1);
    expect(result).toBeFalsy();
  });
});
