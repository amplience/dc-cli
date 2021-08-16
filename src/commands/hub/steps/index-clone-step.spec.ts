import { Arguments } from 'yargs';
import { FileLog } from '../../../common/file-log';
import { ensureDirectoryExists } from '../../../common/import/directory-utils';
import { CloneHubBuilderOptions } from '../../../interfaces/clone-hub-builder-options';
import { ConfigurationParameters } from '../../configure';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';
import rmdir from 'rimraf';

import * as indexImport from '../../search-index/import';
import * as indexExport from '../../search-index/export';

import { IndexCloneStep } from './index-clone-step';
import { CloneHubStepId } from '../model/clone-hub-step';

jest.mock('../../../services/dynamic-content-client-factory');
jest.mock('../../search-index/import');
jest.mock('../../search-index/export');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('index clone step', () => {
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
  }

  beforeEach(async () => {
    reset();
  });

  beforeAll(async () => {
    await rimraf('temp/clone-ext/');
  });

  afterAll(async () => {
    await rimraf('temp/clone-ext/');
  });

  function generateState(directory: string, logName: string): CloneHubState {
    const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
      ...yargArgs,
      ...config,
      logFile: new FileLog(),

      dir: directory,

      dstHubId: 'hub2-id',
      dstClientId: 'acc2-id',
      dstSecret: 'acc2-secret',
      revertLog: Promise.resolve(new FileLog())
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

  it('should have the id "index"', () => {
    const step = new IndexCloneStep();
    expect(step.getId()).toEqual(CloneHubStepId.Index);
  });

  it('should have the name "Clone Indexes"', () => {
    const step = new IndexCloneStep();
    expect(step.getName()).toEqual('Clone Indexes');
  });

  it('should call export on the source, backup and import to the destination', async () => {
    const state = generateState('temp/clone-ext/run/', 'run');

    (indexImport.handler as jest.Mock).mockResolvedValue(true);
    (indexExport.handler as jest.Mock).mockResolvedValue(true);

    const step = new IndexCloneStep();
    const result = await step.run(state);
    // Backup
    expect(indexExport.handler).toHaveBeenNthCalledWith(1, {
      dir: join(state.path, 'oldIndex'),
      force: true,
      logFile: state.logFile,
      ...state.to
    });

    // Export
    expect(indexExport.handler).toHaveBeenNthCalledWith(2, {
      dir: join(state.path, 'index'),
      force: true,
      logFile: state.logFile,
      ...state.from
    });

    expect(indexImport.handler).toBeCalledWith({
      dir: join(state.path, 'index'),
      logFile: state.logFile,
      webhooks: true,
      ...state.to
    });

    expect(result).toBeTruthy();
  });

  it('should fail the step when the export, backup or import fails', async () => {
    const state = generateState('temp/clone-ext/run/', 'run');

    (indexExport.handler as jest.Mock).mockRejectedValue(false);

    const step = new IndexCloneStep();
    const backupFail = await step.run(state);

    expect(backupFail).toBeFalsy();
    expect(indexExport.handler).toBeCalledTimes(1);
    expect(indexImport.handler).not.toBeCalled();

    reset();

    (indexExport.handler as jest.Mock).mockResolvedValueOnce(true);
    (indexExport.handler as jest.Mock).mockRejectedValueOnce(false);

    const exportFail = await step.run(state);

    expect(exportFail).toBeFalsy();
    expect(indexExport.handler).toBeCalledTimes(2);
    expect(indexImport.handler).not.toBeCalled();

    reset();

    (indexExport.handler as jest.Mock).mockResolvedValue(true);
    (indexImport.handler as jest.Mock).mockRejectedValue(false);

    const importFail = await step.run(state);

    expect(importFail).toBeFalsy();
    expect(indexExport.handler).toBeCalledTimes(2);
    expect(indexImport.handler).toBeCalled();
  });

  it('should pass indexes with the UPDATE action to the index import command on revert, in the oldIndex folder', async () => {
    const state = generateState('temp/clone-ext/revert-update/', 'revert-update');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Indexes');
    fakeLog.addAction('CREATE', 'index');
    fakeLog.addAction('UPDATE', 'index2');

    await ensureDirectoryExists('temp/clone-ext/revert-update/oldIndex');

    state.revertLog = fakeLog;

    const step = new IndexCloneStep();
    const result = await step.revert(state);

    expect(indexImport.handler).toBeCalledWith(
      {
        dir: join(state.path, 'oldIndex'),
        logFile: state.logFile,
        ...state.to
      },
      ['index2']
    );

    expect(result).toBeTruthy();
  });

  it('should not call import indexes when no update actions can be reverted', async () => {
    const state = generateState('temp/clone-ext/revert-none/', 'revert-none');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Indexes');
    fakeLog.addAction('CREATE', 'index');

    await ensureDirectoryExists('temp/clone-ext/revert-none/oldIndex');

    state.revertLog = fakeLog;
    (indexImport.handler as jest.Mock).mockRejectedValue(false);

    const step = new IndexCloneStep();
    const result = await step.revert(state);

    expect(indexImport.handler).not.toHaveBeenCalled();

    expect(result).toBeTruthy();
  });

  it('should return false when importing indexes for revert fails', async () => {
    const state = generateState('temp/clone-ext/revert-update/', 'revert-update');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Indexes');
    fakeLog.addAction('CREATE', 'index');
    fakeLog.addAction('UPDATE', 'index2');

    await ensureDirectoryExists('temp/clone-ext/revert-update/oldIndex');

    state.revertLog = fakeLog;
    (indexImport.handler as jest.Mock).mockRejectedValue(false);

    const step = new IndexCloneStep();
    const result = await step.revert(state);

    expect(result).toBeFalsy();
  });
});
