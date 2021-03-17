import { Arguments } from 'yargs';
import { MockContent } from '../../../common/dc-management-sdk-js/mock-content';
import { FileLog } from '../../../common/file-log';
import { ensureDirectoryExists } from '../../../common/import/directory-utils';
import { CloneHubBuilderOptions } from '../../../interfaces/clone-hub-builder-options';
import dynamicContentClientFactory from '../../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../../configure';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';
import rmdir from 'rimraf';

import * as typeImport from '../../content-type/import';
import * as typeExport from '../../content-type/export';

import { TypeCloneStep } from './type-clone-step';

jest.mock('../../../services/dynamic-content-client-factory');
jest.mock('../../content-type/import');
jest.mock('../../content-type/export');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('type clone step', () => {
  let mockContent: MockContent;

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

    mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
    mockContent.createMockRepository('targetRepo');
    mockContent.registerContentType('http://type', 'type', 'targetRepo');
    mockContent.registerContentType('http://type2', 'type2', 'targetRepo');
    mockContent.registerContentType('http://type3', 'type3', 'targetRepo');
  }

  beforeEach(async () => {
    reset();
  });

  beforeAll(async () => {
    await rimraf('temp/clone-type/');
  });

  afterAll(async () => {
    await rimraf('temp/clone-type/');
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

  it('should have the name "Clone Content Types"', () => {
    const step = new TypeCloneStep();
    expect(step.getName()).toEqual('Clone Content Types');
  });

  it('should call export on the source, backup and import to the destination', async () => {
    const state = generateState('temp/clone-type/run/', 'run');

    (typeImport.handler as jest.Mock).mockResolvedValue(true);
    (typeExport.handler as jest.Mock).mockResolvedValue(true);

    const step = new TypeCloneStep();
    const result = await step.run(state);
    // Backup
    expect(typeExport.handler).toHaveBeenNthCalledWith(1, {
      dir: join(state.path, 'oldType'),
      force: true,
      logFile: state.logFile,
      ...state.to
    });

    // Export
    expect(typeExport.handler).toHaveBeenNthCalledWith(2, {
      dir: join(state.path, 'type'),
      force: true,
      logFile: state.logFile,
      ...state.from
    });

    expect(typeImport.handler).toBeCalledWith({
      dir: join(state.path, 'type'),
      sync: true,
      logFile: state.logFile,
      ...state.to
    });

    expect(result).toBeTruthy();
  });

  it('should fail the step when the export, backup or import fails', async () => {
    const state = generateState('temp/clone-type/run/', 'run');

    (typeExport.handler as jest.Mock).mockRejectedValue(false);

    const step = new TypeCloneStep();
    const backupFail = await step.run(state);

    expect(backupFail).toBeFalsy();
    expect(typeExport.handler).toBeCalledTimes(1);
    expect(typeImport.handler).not.toBeCalled();

    reset();

    (typeExport.handler as jest.Mock).mockResolvedValueOnce(true);
    (typeExport.handler as jest.Mock).mockRejectedValueOnce(false);

    const exportFail = await step.run(state);

    expect(exportFail).toBeFalsy();
    expect(typeExport.handler).toBeCalledTimes(2);
    expect(typeImport.handler).not.toBeCalled();

    reset();

    (typeExport.handler as jest.Mock).mockResolvedValue(true);
    (typeImport.handler as jest.Mock).mockRejectedValue(false);

    const importFail = await step.run(state);

    expect(importFail).toBeFalsy();
    expect(typeExport.handler).toBeCalledTimes(2);
    expect(typeImport.handler).toBeCalled();
  });

  it('should attempt to archive types with the CREATE action on revert, skipping archived types', async () => {
    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Content Types');
    fakeLog.addAction('CREATE', 'type');
    fakeLog.addAction('CREATE', 'type3'); // is archived

    const state = generateState('temp/clone-type/revert-create/', 'revert-create');

    await ensureDirectoryExists('temp/clone-type/revert-create/oldType');
    const client = dynamicContentClientFactory(config);
    await (await client.contentTypes.get('type3')).related.archive();

    state.revertLog = fakeLog;
    mockContent.metrics.typesArchived = 0;

    const step = new TypeCloneStep();
    await step.revert(state);

    expect(mockContent.metrics.typesArchived).toEqual(1);
    expect(typeImport.handler).not.toBeCalled();
  });

  it('should pass types with the UPDATE action to the type import command on revert, in the oldType folder', async () => {
    const state = generateState('temp/clone-type/revert-update/', 'revert-update');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Content Types');
    fakeLog.addAction('CREATE', 'type');
    fakeLog.addAction('UPDATE', 'type2 0 1');

    await ensureDirectoryExists('temp/clone-type/revert-update/oldType');

    state.revertLog = fakeLog;

    const step = new TypeCloneStep();
    const result = await step.revert(state);

    expect(mockContent.metrics.typesArchived).toEqual(1);
    expect(typeImport.handler).toBeCalledWith(
      {
        dir: join(state.path, 'oldType'),
        sync: true,
        logFile: state.logFile,
        ...state.to
      },
      ['type2']
    );

    expect(result).toBeTruthy();
  });

  it('should return false when importing types for revert fails', async () => {
    const state = generateState('temp/clone-type/revert-update/', 'revert-update');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Content Types');
    fakeLog.addAction('CREATE', 'type');
    fakeLog.addAction('UPDATE', 'type2 0 1');

    await ensureDirectoryExists('temp/clone-type/revert-update/oldType');

    state.revertLog = fakeLog;
    (typeImport.handler as jest.Mock).mockRejectedValue(false);

    const step = new TypeCloneStep();
    const result = await step.revert(state);

    expect(mockContent.metrics.typesArchived).toEqual(1);
    expect(result).toBeFalsy();
  });
});
