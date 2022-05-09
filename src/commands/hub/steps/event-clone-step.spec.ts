import { Arguments } from 'yargs';
import { Event } from 'dc-management-sdk-js';
import { FileLog } from '../../../common/file-log';
import { ensureDirectoryExists } from '../../../common/import/directory-utils';
import { CloneHubBuilderOptions } from '../../../interfaces/clone-hub-builder-options';
import dynamicContentClientFactory from '../../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../../configure';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';
import rmdir from 'rimraf';

import * as eventImport from '../../event/import';
import * as eventExport from '../../event/export';

import { EventCloneStep } from './event-clone-step';
import { CloneHubStepId } from '../model/clone-hub-step';

jest.mock('../../../services/dynamic-content-client-factory');
jest.mock('../../event/import');
jest.mock('../../event/export');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('event clone step', () => {
  let mockGetEvent: jest.Mock;
  let mockArchiveEvent: jest.Mock;
  let mockFailArchiveEvent: jest.Mock;

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

    mockGetEvent = jest.fn();
    mockArchiveEvent = jest.fn();
    mockFailArchiveEvent = jest.fn().mockRejectedValue(new Error('Already archived'));

    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      events: {
        get: mockGetEvent
      }
    });

    const event = new Event({
      id: 'event1'
    });

    event.related.archive = mockArchiveEvent;

    const event3 = new Event({
      id: 'event3'
    });

    event3.related.archive = mockFailArchiveEvent;

    mockGetEvent.mockImplementation(id => {
      return Promise.resolve(id === 'event3' ? event3 : event);
    });
    mockArchiveEvent.mockResolvedValue(event);
  }

  beforeEach(async () => {
    reset();
  });

  beforeAll(async () => {
    await rimraf(`temp_${process.env.JEST_WORKER_ID}/clone-event/`);
  });

  afterAll(async () => {
    await rimraf(`temp_${process.env.JEST_WORKER_ID}/clone-event/`);
  });

  function generateState(directory: string, logName: string): CloneHubState {
    const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
      ...yargArgs,
      ...config,
      logFile: new FileLog(),
      acceptSnapshotLimits: true,
      mapFile: 'mapping.json',

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

  it('should have the id "event"', () => {
    const step = new EventCloneStep();
    expect(step.getId()).toEqual(CloneHubStepId.Event);
  });

  it('should have the name "Clone Content Events"', () => {
    const step = new EventCloneStep();
    expect(step.getName()).toEqual('Clone Events');
  });

  it('should call export on the source, backup and import to the destination', async () => {
    const state = generateState(`temp_${process.env.JEST_WORKER_ID}/clone-event/run/`, 'run');

    (eventImport.handler as jest.Mock).mockResolvedValue(true);
    (eventExport.handler as jest.Mock).mockResolvedValue(true);

    const step = new EventCloneStep();
    const result = await step.run(state);
    // Backup
    expect(eventExport.handler).toHaveBeenNthCalledWith(1, {
      dir: join(state.path, 'oldEvent'),
      force: true,
      snapshots: false,
      logFile: state.logFile,
      ...state.to
    });

    // Export
    expect(eventExport.handler).toHaveBeenNthCalledWith(2, {
      dir: join(state.path, 'event'),
      force: true,
      snapshots: false,
      logFile: state.logFile,
      ...state.from
    });

    expect(eventImport.handler).toBeCalledWith({
      dir: join(state.path, 'event'),
      originalIds: false,
      schedule: true,
      acceptSnapshotLimits: true,
      mapFile: 'mapping.json',
      catchup: false,
      logFile: state.logFile,
      ...state.to
    });

    expect(result).toBeTruthy();
  });

  it('should fail the step when the export, backup or import fails', async () => {
    const state = generateState(`temp_${process.env.JEST_WORKER_ID}/clone-event/run/`, 'run');

    (eventExport.handler as jest.Mock).mockRejectedValue(false);

    const step = new EventCloneStep();
    const backupFail = await step.run(state);

    expect(backupFail).toBeFalsy();
    expect(eventExport.handler).toBeCalledTimes(1);
    expect(eventImport.handler).not.toBeCalled();

    reset();

    (eventExport.handler as jest.Mock).mockResolvedValueOnce(true);
    (eventExport.handler as jest.Mock).mockRejectedValueOnce(false);

    const exportFail = await step.run(state);

    expect(exportFail).toBeFalsy();
    expect(eventExport.handler).toBeCalledTimes(2);
    expect(eventImport.handler).not.toBeCalled();

    reset();

    (eventExport.handler as jest.Mock).mockResolvedValue(true);
    (eventImport.handler as jest.Mock).mockRejectedValue(false);

    const importFail = await step.run(state);

    expect(importFail).toBeFalsy();
    expect(eventExport.handler).toBeCalledTimes(2);
    expect(eventImport.handler).toBeCalled();
  });

  it('should attempt to archive events with the CREATE action on revert, skipping archived events', async () => {
    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Events');
    fakeLog.addAction('EVENT-CREATE', 'event');
    fakeLog.addAction('EVENT-CREATE', 'event3'); // is archived

    const state = generateState(`temp_${process.env.JEST_WORKER_ID}/clone-event/revert-create/`, 'revert-create');

    await ensureDirectoryExists(`temp_${process.env.JEST_WORKER_ID}/clone-event/revert-create/oldEvent`);

    state.revertLog = fakeLog;

    const step = new EventCloneStep();
    await step.revert(state);

    expect(mockArchiveEvent).toHaveBeenCalledTimes(1);
    expect(mockFailArchiveEvent).toHaveBeenCalledTimes(1);
    expect(state.logFile.getData('ARCHIVE').length).toEqual(1);
    expect(eventImport.handler).not.toBeCalled();
  });

  it('should pass events with the UPDATE action to the event import command on revert, in the oldEvent folder', async () => {
    const state = generateState(`temp_${process.env.JEST_WORKER_ID}/clone-event/revert-update/`, 'revert-update');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Events');
    fakeLog.addAction('EVENT-CREATE', 'event');
    fakeLog.addAction('EVENT-UPDATE', 'event2 0 1');

    await ensureDirectoryExists(`temp_${process.env.JEST_WORKER_ID}/clone-event/revert-update/oldEvent`);

    state.revertLog = fakeLog;

    const step = new EventCloneStep();
    const result = await step.revert(state);

    expect(mockArchiveEvent).toHaveBeenCalledTimes(1);
    expect(eventImport.handler).toBeCalledWith({
      dir: join(state.path, 'oldEvent'),
      originalIds: true,
      schedule: true,
      acceptSnapshotLimits: true,
      mapFile: 'mapping.json',
      catchup: false,
      logFile: state.logFile,
      ...state.to
    });

    expect(result).toBeTruthy();
  });

  it('should return false when importing events for revert fails', async () => {
    const state = generateState(`temp_${process.env.JEST_WORKER_ID}/clone-event/revert-update/`, 'revert-update');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Events');
    fakeLog.addAction('EVENT-CREATE', 'event');
    fakeLog.addAction('EVENT-UPDATE', 'event2 0 1');

    await ensureDirectoryExists(`temp_${process.env.JEST_WORKER_ID}/clone-event/revert-update/oldEvent`);

    state.revertLog = fakeLog;
    (eventImport.handler as jest.Mock).mockRejectedValue(false);

    const step = new EventCloneStep();
    const result = await step.revert(state);

    expect(mockArchiveEvent).toHaveBeenCalledTimes(1);
    expect(result).toBeFalsy();
  });
});
