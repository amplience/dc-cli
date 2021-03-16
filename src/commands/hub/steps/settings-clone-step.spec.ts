import { Arguments } from 'yargs';
import { FileLog } from '../../../common/file-log';
import { CloneHubBuilderOptions } from '../../../interfaces/clone-hub-builder-options';
import { ConfigurationParameters } from '../../configure';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';
import * as fs from 'fs';

import * as settingsImport from '../../settings/import';
import * as settingsExport from '../../settings/export';

import { SettingsCloneStep } from './settings-clone-step';

jest.mock('../../../services/dynamic-content-client-factory');
jest.mock('../../settings/import');
jest.mock('../../settings/export');
jest.mock('fs');
jest.mock('../../../common/import/directory-utils');

describe('settings clone step', () => {
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

  it('should have the name "Clone Settings"', () => {
    const step = new SettingsCloneStep();
    expect(step.getName()).toEqual('Clone Settings');
  });

  it('should call the settings commands with arguments from the state, importing the result of the export and performing a backup', async () => {
    const state = generateState('temp/clone-settings/run/', 'run');

    (settingsImport.handler as jest.Mock).mockResolvedValue(true);
    (settingsExport.handler as jest.Mock).mockResolvedValue(true);

    const settingsFile = 'hub-hub-id-test.json';
    (fs.readdirSync as jest.Mock).mockReturnValue([settingsFile]);

    const step = new SettingsCloneStep();
    const result = await step.run(state);

    // Export
    expect(settingsExport.handler).toHaveBeenNthCalledWith(1, {
      dir: join(state.path, 'settings'),
      logFile: state.logFile,
      force: state.argv.force,
      ...state.from
    });

    // Backup
    expect(settingsExport.handler).toHaveBeenNthCalledWith(2, {
      dir: join(state.path, 'settings'),
      logFile: state.logFile,
      force: state.argv.force,
      ...state.to
    });

    // Import
    expect(settingsImport.handler).toHaveBeenCalledWith({
      filePath: join(state.path, 'settings', settingsFile),
      mapFile: state.argv.mapFile,
      force: state.argv.force,
      logFile: state.logFile,
      ...state.to
    });

    expect(result).toBeTruthy();
  });

  it('should return false when exporting fails, the exported file is missing or import fails', async () => {
    const state = generateState('temp/clone-settings/fail/', 'fail');
    const step = new SettingsCloneStep();

    (settingsImport.handler as jest.Mock).mockResolvedValue(true);
    (settingsExport.handler as jest.Mock).mockRejectedValue(false);

    const settingsFile = 'hub-hub-id-test.json';
    (fs.readdirSync as jest.Mock).mockReturnValue([settingsFile]);

    const failedExport = await step.run(state);

    expect(failedExport).toBeFalsy();
    expect(settingsExport.handler).toHaveBeenCalledTimes(1);
    expect(settingsImport.handler).not.toHaveBeenCalled();

    reset();

    (settingsImport.handler as jest.Mock).mockResolvedValue(true);
    (settingsExport.handler as jest.Mock).mockResolvedValue(true);

    // Hub ID must match the source.
    (fs.readdirSync as jest.Mock).mockReturnValue(['mismatch', 'hub-hub2-id-test.json']);
    const missingExport = await step.run(state);

    expect(missingExport).toBeFalsy();
    expect(settingsExport.handler).toHaveBeenCalledTimes(2);
    expect(settingsImport.handler).not.toHaveBeenCalled();

    reset();

    (settingsImport.handler as jest.Mock).mockRejectedValue(false);
    (settingsExport.handler as jest.Mock).mockResolvedValue(true);

    (fs.readdirSync as jest.Mock).mockReturnValue([settingsFile]);
    const failingImport = await step.run(state);

    expect(failingImport).toBeFalsy();
    expect(settingsExport.handler).toHaveBeenCalledTimes(2);
    expect(settingsImport.handler).toHaveBeenCalled();

    reset();

    (settingsImport.handler as jest.Mock).mockResolvedValue(true);
    (settingsExport.handler as jest.Mock).mockResolvedValueOnce(true).mockRejectedValueOnce(false);

    (fs.readdirSync as jest.Mock).mockReturnValue([settingsFile]);
    const backupFailiure = await step.run(state);

    expect(backupFailiure).toBeTruthy();
    expect(settingsExport.handler).toHaveBeenCalledTimes(2);
    expect(settingsImport.handler).toHaveBeenCalled();
  });

  it('should import saved settings in the given directory when reverting', async () => {
    const state = generateState('temp/clone-settings/revert/', 'revert');

    (settingsImport.handler as jest.Mock).mockResolvedValue(true);

    const settingsFile = 'hub-hub2-id-test.json';
    (fs.readdirSync as jest.Mock).mockReturnValue([settingsFile]);

    const step = new SettingsCloneStep();
    const result = await step.revert(state);

    expect(settingsImport.handler).toHaveBeenCalledWith({
      filePath: join(state.path, 'settings', settingsFile),
      mapFile: state.argv.mapFile,
      force: state.argv.force,
      logFile: state.logFile,
      ...state.to
    });

    expect(result).toBeTruthy();
  });

  it('should fail revert if the saved settings are missing, or the import of them fails', async () => {
    const state = generateState('temp/clone-settings/revert-fail/', 'revert-fail');
    const step = new SettingsCloneStep();

    (settingsImport.handler as jest.Mock).mockResolvedValue(true);

    // Settings file is not present.
    (fs.readdirSync as jest.Mock).mockReturnValue(['missing', 'hub-hub-id-test.json']);

    const revertSettingsMissing = await step.revert(state);

    expect(settingsImport.handler).not.toHaveBeenCalled();
    expect(revertSettingsMissing).toBeFalsy();

    reset();

    // Settings file is present, but import fails.
    (settingsImport.handler as jest.Mock).mockRejectedValue(false);

    (fs.readdirSync as jest.Mock).mockReturnValue(['hub-hub2-id-test.json']);

    const importFailed = await step.revert(state);

    expect(settingsImport.handler).toHaveBeenCalled();
    expect(importFailed).toBeFalsy();
  });
});
