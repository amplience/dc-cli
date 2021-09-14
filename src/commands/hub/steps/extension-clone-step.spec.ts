import { Arguments } from 'yargs';
import { FileLog } from '../../../common/file-log';
import { ensureDirectoryExists } from '../../../common/import/directory-utils';
import { CloneHubBuilderOptions } from '../../../interfaces/clone-hub-builder-options';
import { ConfigurationParameters } from '../../configure';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';
import rmdir from 'rimraf';

import * as extensionImport from '../../extension/import';
import * as extensionExport from '../../extension/export';

import { ExtensionCloneStep } from './extension-clone-step';
import { CloneHubStepId } from '../model/clone-hub-step';

jest.mock('../../../services/dynamic-content-client-factory');
jest.mock('../../extension/import');
jest.mock('../../extension/export');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('extension clone step', () => {
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

  it('should have the id "extension"', () => {
    const step = new ExtensionCloneStep();
    expect(step.getId()).toEqual(CloneHubStepId.Extension);
  });

  it('should have the name "Clone Extensions"', () => {
    const step = new ExtensionCloneStep();
    expect(step.getName()).toEqual('Clone Extensions');
  });

  it('should call export on the source, backup and import to the destination', async () => {
    const state = generateState('temp/clone-ext/run/', 'run');

    (extensionImport.handler as jest.Mock).mockResolvedValue(true);
    (extensionExport.handler as jest.Mock).mockResolvedValue(true);

    const step = new ExtensionCloneStep();
    const result = await step.run(state);
    // Backup
    expect(extensionExport.handler).toHaveBeenNthCalledWith(1, {
      dir: join(state.path, 'oldExtension'),
      force: true,
      logFile: state.logFile,
      ...state.to
    });

    // Export
    expect(extensionExport.handler).toHaveBeenNthCalledWith(2, {
      dir: join(state.path, 'extension'),
      force: true,
      logFile: state.logFile,
      ...state.from
    });

    expect(extensionImport.handler).toBeCalledWith({
      dir: join(state.path, 'extension'),
      logFile: state.logFile,
      ...state.to
    });

    expect(result).toBeTruthy();
  });

  it('should fail the step when the export, backup or import fails', async () => {
    const state = generateState('temp/clone-ext/run/', 'run');

    (extensionExport.handler as jest.Mock).mockRejectedValue(false);

    const step = new ExtensionCloneStep();
    const backupFail = await step.run(state);

    expect(backupFail).toBeFalsy();
    expect(extensionExport.handler).toBeCalledTimes(1);
    expect(extensionImport.handler).not.toBeCalled();

    reset();

    (extensionExport.handler as jest.Mock).mockResolvedValueOnce(true);
    (extensionExport.handler as jest.Mock).mockRejectedValueOnce(false);

    const exportFail = await step.run(state);

    expect(exportFail).toBeFalsy();
    expect(extensionExport.handler).toBeCalledTimes(2);
    expect(extensionImport.handler).not.toBeCalled();

    reset();

    (extensionExport.handler as jest.Mock).mockResolvedValue(true);
    (extensionImport.handler as jest.Mock).mockRejectedValue(false);

    const importFail = await step.run(state);

    expect(importFail).toBeFalsy();
    expect(extensionExport.handler).toBeCalledTimes(2);
    expect(extensionImport.handler).toBeCalled();
  });

  it('should pass extensions with the UPDATE action to the extension import command on revert, in the oldExtension folder', async () => {
    const state = generateState('temp/clone-ext/revert-update/', 'revert-update');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Extensions');
    fakeLog.addAction('CREATE', 'extension');
    fakeLog.addAction('UPDATE', 'extension2');

    await ensureDirectoryExists('temp/clone-ext/revert-update/oldExtension');

    state.revertLog = fakeLog;

    const step = new ExtensionCloneStep();
    const result = await step.revert(state);

    expect(extensionImport.handler).toBeCalledWith(
      {
        dir: join(state.path, 'oldExtension'),
        logFile: state.logFile,
        ...state.to
      },
      ['extension2']
    );

    expect(result).toBeTruthy();
  });

  it('should not call import extensions when no update actions can be reverted', async () => {
    const state = generateState('temp/clone-ext/revert-none/', 'revert-none');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Extensions');
    fakeLog.addAction('CREATE', 'extension');

    await ensureDirectoryExists('temp/clone-ext/revert-none/oldExtension');

    state.revertLog = fakeLog;
    (extensionImport.handler as jest.Mock).mockRejectedValue(false);

    const step = new ExtensionCloneStep();
    const result = await step.revert(state);

    expect(extensionImport.handler).not.toHaveBeenCalled();

    expect(result).toBeTruthy();
  });

  it('should return false when importing extensions for revert fails', async () => {
    const state = generateState('temp/clone-ext/revert-update/', 'revert-update');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Extensions');
    fakeLog.addAction('CREATE', 'extension');
    fakeLog.addAction('UPDATE', 'extension2');

    await ensureDirectoryExists('temp/clone-ext/revert-update/oldExtension');

    state.revertLog = fakeLog;
    (extensionImport.handler as jest.Mock).mockRejectedValue(false);

    const step = new ExtensionCloneStep();
    const result = await step.revert(state);

    expect(result).toBeFalsy();
  });
});
