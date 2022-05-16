import {
  builder,
  command,
  getDefaultMappingPath,
  handler,
  importEditions,
  importEvents,
  importSlots,
  LOG_FILENAME,
  trySaveMapping
} from './import';
import * as importModule from './import';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Event, Edition, Hub, EditionSlot, Snapshot, DynamicContent, PublishingStatus } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import MockPage from '../../common/dc-management-sdk-js/mock-page';

import rmdir from 'rimraf';
import { FileLog } from '../../common/file-log';
import { ContentMapping } from '../../common/content-mapping';
import { mockValues } from './event-test-helpers';
import { EditionWithSlots, EventWithEditions } from './export';
import { ImportEventBuilderOptions } from '../../interfaces/import-event-builder-options.interface';
import { loadJsonFromDirectory } from '../../services/import.service';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { dateOffset } from '../../common/import/date-helpers';
import { ensureDirectoryExists } from '../../common/import/directory-utils';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../services/import.service');

jest.mock('../../common/log-helpers', () => ({
  ...jest.requireActual('../../common/log-helpers'),
  getDefaultLogPath: jest.fn()
}));

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('event import command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  const yargArgs = {
    $0: 'test',
    _: ['test'],
    json: true,
    silent: true
  };

  const config = {
    clientId: 'client-id',
    clientSecret: 'client-id',
    hubId: 'hub-id',
    schedule: false,
    acceptSnapshotLimits: true,
    catchup: true
  };

  const commonMock = async (
    customArgs = {}
  ): Promise<{
    client: DynamicContent;
    hub: Hub;
    argv: ImportEventBuilderOptions;
    log: FileLog;
    mapping: ContentMapping;
  }> => {
    const client = await dynamicContentClientFactory(config);
    const log = new FileLog();
    return {
      client,
      hub: await client.hubs.get('hub-id'),
      log: log,
      mapping: new ContentMapping(),
      argv: {
        ...yargArgs,
        ...config,
        dir: '',
        originalIds: false,
        acceptSnapshotLimits: true,
        logFile: log,
        ...customArgs
      }
    };
  };

  it('should command should defined', function() {
    expect(command).toEqual('import <dir>');
  });

  it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function() {
    LOG_FILENAME();

    expect(getDefaultLogPath).toHaveBeenCalledWith('event', 'import', process.platform);
  });

  it('should generate a default mapping path containing the given name', function() {
    expect(getDefaultMappingPath('hub-1').indexOf('hub-1')).not.toEqual(-1);
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Directory containing Events',
        type: 'string'
      });

      expect(spyOption).toHaveBeenCalledWith('acceptSnapshotLimits', {
        type: 'boolean',
        boolean: true,
        describe:
          'Must be passed to use the event import command. Only use this command if you fully understand its limitations.'
      });

      expect(spyOption).toHaveBeenCalledWith('mapFile', {
        type: 'string',
        describe:
          'Mapping file to use when updating content that already exists. Updated with any new mappings that are generated. If not present, will be created.'
      });

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'Overwrite existing events, editions, slots and snapshots without asking.'
      });

      expect(spyOption).toHaveBeenCalledWith('originalIds', {
        type: 'boolean',
        boolean: true,
        describe: 'Use original ids'
      });

      expect(spyOption).toHaveBeenCalledWith('schedule', {
        type: 'boolean',
        boolean: true,
        describe:
          'Schedule events in the destination repo if they are scheduled in the source. If any new or updated scheduled events started in the past, they will be moved to happen at the time of import. If they ended in the past, they will be skipped by default.'
      });

      expect(spyOption).toHaveBeenCalledWith('catchup', {
        type: 'boolean',
        boolean: true,
        describe: 'Scheduling events that ended in the past will move to the current date, so that their publishes run.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: createLog
      });
    });
  });

  describe('handler tests', function() {
    beforeAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/importEvent/`);
    });

    afterAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/importEvent/`);
    });

    it('should return immediately if acceptSnapshotLimits is false', async function() {
      const { getHubMock } = mockValues({});

      const logFile = new FileLog();
      const argv = {
        ...yargArgs,
        ...config,
        logFile,
        dir: `temp_${process.env.JEST_WORKER_ID}/importEvent/`,
        acceptSnapshotLimits: false,
        catchup: false,
        originalIds: false
      };
      const event = new EventWithEditions({ id: 'id-1' });

      (loadJsonFromDirectory as jest.Mock).mockResolvedValue({
        'event1.json': event
      });

      const importEvents = jest.spyOn(importModule, 'importEvents').mockResolvedValue();
      const trySaveMapping = jest.spyOn(importModule, 'trySaveMapping').mockResolvedValue();
      const getDefaultMappingPath = jest.spyOn(importModule, 'getDefaultMappingPath').mockReturnValue('mapping.json');

      await handler(argv);

      expect(getHubMock).not.toHaveBeenCalled();
      expect(loadJsonFromDirectory as jest.Mock).not.toHaveBeenCalled();

      expect(importEvents).not.toHaveBeenCalled();
      expect(getDefaultMappingPath).not.toHaveBeenCalled();
      expect(trySaveMapping).not.toHaveBeenCalled();
      expect(logFile.closed).toBeFalsy();
    });

    it('should call importEvents with the loaded events, then save the mapping', async function() {
      const { getHubMock } = mockValues({});

      const logFile = new FileLog();
      const argv = {
        ...yargArgs,
        ...config,
        logFile,
        dir: `temp_${process.env.JEST_WORKER_ID}/importEvent/`,
        originalIds: false
      };
      const event = new EventWithEditions({ id: 'id-1' });

      (loadJsonFromDirectory as jest.Mock).mockResolvedValue({
        'event1.json': event
      });

      const importEvents = jest.spyOn(importModule, 'importEvents').mockResolvedValue();
      const trySaveMapping = jest.spyOn(importModule, 'trySaveMapping').mockResolvedValue();
      const getDefaultMappingPath = jest.spyOn(importModule, 'getDefaultMappingPath').mockReturnValue('mapping.json');

      await handler(argv);

      expect(getHubMock).toHaveBeenCalledWith('hub-id'); //from returned hub
      expect(loadJsonFromDirectory as jest.Mock).toHaveBeenCalledWith(
        `temp_${process.env.JEST_WORKER_ID}/importEvent/`,
        EventWithEditions
      );

      expect(importEvents).toHaveBeenCalledWith(
        [event],
        expect.any(ContentMapping),
        expect.any(Object),
        expect.any(Hub),
        argv,
        logFile
      );
      expect(getDefaultMappingPath).toHaveBeenCalledWith('hub-1');
      expect(trySaveMapping).toHaveBeenCalledWith('mapping.json', expect.any(ContentMapping), logFile);
      expect(logFile.closed).toBeTruthy();
    });

    it('should load an existing mapping file', async function() {
      const { getHubMock } = mockValues({});

      const logFile = new FileLog();
      const argv = {
        ...yargArgs,
        ...config,
        logFile,
        mapFile: `temp_${process.env.JEST_WORKER_ID}/importEvent/importEvent.json`,
        dir: `temp_${process.env.JEST_WORKER_ID}/importEvent/`,
        originalIds: false
      };
      const event = new EventWithEditions({ id: 'id-1' });

      (loadJsonFromDirectory as jest.Mock).mockResolvedValue({
        'event1.json': event
      });

      const importEvents = jest.spyOn(importModule, 'importEvents').mockResolvedValue();
      const trySaveMapping = jest.spyOn(importModule, 'trySaveMapping').mockResolvedValue();
      const getDefaultMappingPath = jest.spyOn(importModule, 'getDefaultMappingPath');

      await ensureDirectoryExists(`temp_${process.env.JEST_WORKER_ID}/importEvent/`);

      const existingMapping = new ContentMapping();
      await existingMapping.save(argv.mapFile);

      await handler(argv);

      expect(getHubMock).toHaveBeenCalledWith('hub-id'); //from returned hub
      expect(loadJsonFromDirectory as jest.Mock).toHaveBeenCalledWith(
        `temp_${process.env.JEST_WORKER_ID}/importEvent/`,
        EventWithEditions
      );

      expect(importEvents).toHaveBeenCalledWith(
        [event],
        expect.any(ContentMapping),
        expect.any(Object),
        expect.any(Hub),
        argv,
        logFile
      );
      expect(getDefaultMappingPath).not.toHaveBeenCalled();
      expect(trySaveMapping).toHaveBeenCalledWith(argv.mapFile, expect.any(ContentMapping), logFile);
      expect(logFile.closed).toBeTruthy();
    });

    it('should save the mapping even if importEvents throws', async function() {
      const { getHubMock } = mockValues({});

      const logFile = new FileLog();
      const argv = {
        ...yargArgs,
        ...config,
        logFile,
        dir: `temp_${process.env.JEST_WORKER_ID}/importEvent/`,
        originalIds: false
      };
      const event = new EventWithEditions({ id: 'id-1' });

      (loadJsonFromDirectory as jest.Mock).mockResolvedValue({
        'event1.json': event
      });

      const importEvents = jest.spyOn(importModule, 'importEvents').mockRejectedValue(new Error('Example'));
      const trySaveMapping = jest.spyOn(importModule, 'trySaveMapping').mockResolvedValue();
      const getDefaultMappingPath = jest.spyOn(importModule, 'getDefaultMappingPath').mockReturnValue('mapping.json');

      await handler(argv);

      expect(getHubMock).toHaveBeenCalledWith('hub-id'); //from returned hub
      expect(loadJsonFromDirectory as jest.Mock).toHaveBeenCalledWith(
        `temp_${process.env.JEST_WORKER_ID}/importEvent/`,
        EventWithEditions
      );

      expect(importEvents).toHaveBeenCalledWith(
        [event],
        expect.any(ContentMapping),
        expect.any(Object),
        expect.any(Hub),
        argv,
        logFile
      );
      expect(getDefaultMappingPath).toHaveBeenCalledWith('hub-1');
      expect(trySaveMapping).toHaveBeenCalledWith('mapping.json', expect.any(ContentMapping), logFile);
      expect(logFile.closed).toBeTruthy();
    });
  });

  describe('shouldUpdateSlot tests', function() {
    it('should return false if content matches, true otherwise', async function() {
      const slot1 = new EditionSlot({ content: { example: 'test', example2: { deep: 'is here' } } });
      const slot1dupe = new EditionSlot({ content: { example: 'test', example2: { deep: 'is here' } } });
      const slot2 = new EditionSlot({ content: { example: 'test', example2: { deep: 'mismatch' } } });
      const slot3 = new EditionSlot({ content: { example2: 'diff' } });

      expect(importModule.shouldUpdateSlot(slot1, slot1dupe)).toBeFalsy();
      expect(importModule.shouldUpdateSlot(slot1, slot2)).toBeTruthy();
      expect(importModule.shouldUpdateSlot(slot2, slot3)).toBeTruthy();
      expect(importModule.shouldUpdateSlot(slot1, slot3)).toBeTruthy();
    });
  });

  describe('shouldUpdateEvent tests', function() {
    it('should call boundTimeRange, return false if fields match, true otherwise', async function() {
      const event1 = new Event({ name: 'name', brief: '//brief', comment: 'comment', start: '1', end: '2' });
      const event1dupe = new Event({ name: 'name', brief: '//brief', comment: 'comment', start: '1', end: '2' });
      const event2 = new Event({ name: 'name2', brief: '//brief', comment: 'comment', start: '1', end: '2' });
      const event3 = new Event({ name: 'name', brief: '//brief2', comment: 'comment', start: '1', end: '2' });
      const event4 = new Event({ name: 'name', brief: '//brief', comment: 'comment2', start: '1', end: '2' });
      const event5 = new Event({ name: 'name', brief: '//brief', comment: 'comment', start: '1.5', end: '2' });
      const event6 = new Event({ name: 'name', brief: '//brief', comment: 'comment', start: '1', end: '2.5' });

      jest.spyOn(importModule, 'boundTimeRange').mockReturnValue();

      expect(importModule.shouldUpdateEvent(event1, event1dupe)).toBeFalsy();

      expect(importModule.boundTimeRange).toHaveBeenCalledWith(event1, event1dupe);

      expect(importModule.shouldUpdateEvent(event1, event2)).toBeTruthy();
      expect(importModule.shouldUpdateEvent(event1, event3)).toBeTruthy();
      expect(importModule.shouldUpdateEvent(event1, event4)).toBeTruthy();
      expect(importModule.shouldUpdateEvent(event1, event5)).toBeTruthy();
      expect(importModule.shouldUpdateEvent(event1, event6)).toBeTruthy();
      expect(importModule.shouldUpdateEvent(event3, event4)).toBeTruthy();

      jest.resetAllMocks();
    });
  });

  describe('shouldUpdateEdition tests', function() {
    it('should call boundTimeRange, return false if fields match, true otherwise', async function() {
      const edition1 = new Edition({ name: 'name', activeEndDate: false, comment: 'comment', start: '1', end: '2' });
      const edition1dupe = new EditionWithSlots({
        name: 'name',
        activeEndDate: false,
        comment: 'comment',
        start: '1',
        end: '2',
        slots: []
      });
      const edition2 = new EditionWithSlots({
        name: 'name2',
        activeEndDate: false,
        comment: 'comment',
        start: '1',
        end: '2',
        slots: []
      });
      const edition3 = new EditionWithSlots({
        name: 'name',
        activeEndDate: true,
        comment: 'comment',
        start: '1',
        end: '2',
        slots: []
      });
      const edition4 = new EditionWithSlots({
        name: 'name',
        activeEndDate: false,
        comment: 'comment2',
        start: '1',
        end: '2',
        slots: []
      });
      const edition5 = new EditionWithSlots({
        name: 'name',
        activeEndDate: false,
        comment: 'comment',
        start: '1.5',
        end: '2',
        slots: []
      });
      const edition6 = new EditionWithSlots({
        name: 'name',
        activeEndDate: false,
        comment: 'comment',
        start: '1',
        end: '2.5',
        slots: []
      });

      jest.spyOn(importModule, 'boundTimeRange').mockReturnValue();

      expect(importModule.shouldUpdateEdition(edition1, [], edition1dupe)).toBeFalsy();

      expect(importModule.boundTimeRange).toHaveBeenCalledWith(edition1, edition1dupe);

      expect(importModule.shouldUpdateEdition(edition1, [], edition2)).toBeTruthy();
      expect(importModule.shouldUpdateEdition(edition1, [], edition3)).toBeTruthy();
      expect(importModule.shouldUpdateEdition(edition1, [], edition4)).toBeTruthy();
      expect(importModule.shouldUpdateEdition(edition1, [], edition5)).toBeTruthy();
      expect(importModule.shouldUpdateEdition(edition1, [], edition6)).toBeTruthy();
      expect(importModule.shouldUpdateEdition(edition3, [], edition4)).toBeTruthy();

      jest.resetAllMocks();
    });

    it('should call boundTimeRange, return false if slots match, true otherwise', async function() {
      const edition1 = new Edition({ name: 'name', activeEndDate: false, comment: 'comment', start: '1', end: '2' });
      const edition1dupe = new EditionWithSlots({
        name: 'name',
        activeEndDate: false,
        comment: 'comment',
        start: '1',
        end: '2',
        slots: [new EditionSlot(), new EditionSlot()]
      });

      jest.spyOn(importModule, 'boundTimeRange').mockReturnValue();
      const spyShouldUpdateSlot = jest.spyOn(importModule, 'shouldUpdateSlot');

      // Length different, return true immediately
      expect(importModule.shouldUpdateEdition(edition1, [], edition1dupe)).toBeTruthy();
      expect(importModule.boundTimeRange).toHaveBeenCalledWith(edition1, edition1dupe);
      expect(importModule.shouldUpdateEdition(edition1, [new EditionSlot()], edition1dupe)).toBeTruthy();
      expect(
        importModule.shouldUpdateEdition(
          edition1,
          [new EditionSlot(), new EditionSlot(), new EditionSlot()],
          edition1dupe
        )
      ).toBeTruthy();

      expect(importModule.shouldUpdateSlot).not.toHaveBeenCalled();

      // Identical
      spyShouldUpdateSlot.mockReturnValueOnce(false);
      spyShouldUpdateSlot.mockReturnValueOnce(false);
      expect(
        importModule.shouldUpdateEdition(edition1, [new EditionSlot(), new EditionSlot()], edition1dupe)
      ).toBeFalsy();

      // First different
      spyShouldUpdateSlot.mockReturnValueOnce(true);
      spyShouldUpdateSlot.mockReturnValueOnce(false);
      expect(
        importModule.shouldUpdateEdition(edition1, [new EditionSlot(), new EditionSlot()], edition1dupe)
      ).toBeTruthy();

      // Second different
      spyShouldUpdateSlot.mockReturnValueOnce(false);
      spyShouldUpdateSlot.mockReturnValueOnce(true);
      expect(
        importModule.shouldUpdateEdition(edition1, [new EditionSlot(), new EditionSlot()], edition1dupe)
      ).toBeTruthy();

      // Both different
      spyShouldUpdateSlot.mockReturnValueOnce(true);
      spyShouldUpdateSlot.mockReturnValueOnce(true);
      expect(
        importModule.shouldUpdateEdition(edition1, [new EditionSlot(), new EditionSlot()], edition1dupe)
      ).toBeTruthy();

      jest.resetAllMocks();
    });
  });

  describe('moveDateToFuture tests', function() {
    it('should return the input date if it is in the future', async function() {
      const future = new Date();
      const event = new Event();
      event.related.update = jest.fn();
      future.setSeconds(future.getSeconds() + 60);

      expect(await importModule.moveDateToFuture(future.toISOString(), event, 10)).toEqual(future.toISOString());

      expect(event.related.update).not.toHaveBeenCalled();
    });

    it('should choose a date the given offset from the current date if it is in the past', async function() {
      const past = new Date();
      const futureEvent = new Date();
      const event = new Event();
      event.related.update = jest.fn();
      past.setSeconds(past.getSeconds() - 5);
      futureEvent.setSeconds(futureEvent.getSeconds() + 60);
      event.end = futureEvent.toISOString();

      const result = new Date(await importModule.moveDateToFuture(past.toISOString(), event, 10));
      const expected = new Date();
      const error = 500;
      expected.setSeconds(expected.getSeconds() + 10);
      expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(error);

      expect(event.related.update).not.toHaveBeenCalled();
    });

    it("should update the given event's end date if the new date ends up being after it ends", async function() {
      const past = new Date();
      const futureEvent = new Date();
      const event = new Event();
      event.related.update = jest.fn();
      past.setSeconds(past.getSeconds() - 5);
      futureEvent.setSeconds(futureEvent.getSeconds() + 60);
      event.end = futureEvent.toISOString();

      const result = new Date(await importModule.moveDateToFuture(past.toISOString(), event, 120));
      const expected = new Date();
      const error = 500;
      expected.setSeconds(expected.getSeconds() + 120);
      expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(error);

      expect(event.related.update).toHaveBeenCalled();
      const updateEvent = (event.related.update as jest.Mock).mock.calls[0][0];
      expect(Math.abs(new Date(updateEvent.end).getTime() - expected.getTime())).toBeLessThan(error);
    });
  });

  describe('prepareEditionForSchedule tests', function() {
    it('should move the start and end dates to the future if the edition is scheduled', async function() {
      const edition = new Edition({ start: '1', end: '2', publishingStatus: PublishingStatus.DRAFT });
      const event = new Event();

      const futureSpy = jest.spyOn(importModule, 'moveDateToFuture');
      futureSpy.mockResolvedValueOnce('3');
      futureSpy.mockResolvedValueOnce('4');

      await importModule.prepareEditionForSchedule(edition, event);
      expect(importModule.moveDateToFuture).not.toHaveBeenCalled();

      edition.publishingStatus = PublishingStatus.SCHEDULED;
      await importModule.prepareEditionForSchedule(edition, event);
      expect(importModule.moveDateToFuture).toHaveBeenNthCalledWith(
        1,
        '1',
        event,
        importModule.EditionSecondsAllowance
      );
      expect(importModule.moveDateToFuture).toHaveBeenNthCalledWith(
        2,
        '2',
        event,
        importModule.ScheduleSecondsAllowance
      );
      expect(edition.start).toEqual('3');
      expect(edition.end).toEqual('4');

      jest.resetAllMocks();
    });

    it('should move the start and end dates to the future if the force parameter is true', async function() {
      const edition = new Edition({ start: '1', end: '2', publishingStatus: PublishingStatus.DRAFT });
      const event = new Event();

      const futureSpy = jest.spyOn(importModule, 'moveDateToFuture');
      futureSpy.mockResolvedValueOnce('3');
      futureSpy.mockResolvedValueOnce('4');

      await importModule.prepareEditionForSchedule(edition, event);
      expect(importModule.moveDateToFuture).not.toHaveBeenCalled();

      await importModule.prepareEditionForSchedule(edition, event, true);
      expect(importModule.moveDateToFuture).toHaveBeenNthCalledWith(
        1,
        '1',
        event,
        importModule.EditionSecondsAllowance
      );
      expect(importModule.moveDateToFuture).toHaveBeenNthCalledWith(
        2,
        '2',
        event,
        importModule.ScheduleSecondsAllowance
      );
      expect(edition.start).toEqual('3');
      expect(edition.end).toEqual('4');

      jest.resetAllMocks();
    });
  });

  describe('skipScheduleIfNeeded tests', function() {
    it('should remove scheduled status if the event end is in the past and catchup is false', async function() {
      const date = new Date();
      date.setSeconds(date.getSeconds() - 10);

      const edition = new Edition({ end: date.toISOString(), publishingStatus: PublishingStatus.SCHEDULED });

      importModule.skipScheduleIfNeeded(edition, false);

      expect(edition.publishingStatus).toEqual(PublishingStatus.DRAFT);
    });

    it('should not remove scheduled status if the event end is in the future', async function() {
      const date = new Date();
      date.setSeconds(date.getSeconds() + 10);

      const edition = new Edition({ end: date.toISOString(), publishingStatus: PublishingStatus.SCHEDULED });

      importModule.skipScheduleIfNeeded(edition, false);

      expect(edition.publishingStatus).toEqual(PublishingStatus.SCHEDULED);
    });

    it('should leave the edition unscheduled if it was before', async function() {
      const date = new Date();
      date.setSeconds(date.getSeconds() - 10);

      const edition = new Edition({ end: date.toISOString(), publishingStatus: PublishingStatus.DRAFT });

      importModule.skipScheduleIfNeeded(edition, false);

      expect(edition.publishingStatus).toEqual(PublishingStatus.DRAFT);
    });

    it('should not remove scheduled status if catchup is true, even if the event end is in the past', async function() {
      const date = new Date();
      date.setSeconds(date.getSeconds() - 10);

      const edition = new Edition({ end: date.toISOString(), publishingStatus: PublishingStatus.SCHEDULED });

      importModule.skipScheduleIfNeeded(edition, true);

      expect(edition.publishingStatus).toEqual(PublishingStatus.SCHEDULED);
    });
  });

  describe('scheduleEdition tests', function() {
    it('should schedule without logging anything if no warnings are returned', async function() {
      const edition = new Edition({ lastModifiedDate: 'date' });
      const log = new FileLog();

      edition.related.schedule = jest.fn().mockResolvedValue({});

      await importModule.scheduleEdition(edition, log);

      expect(edition.related.schedule).toHaveBeenCalledTimes(1);
      expect(edition.related.schedule).toHaveBeenCalledWith(false, 'date');
      expect(log.accessGroup).toEqual([]);
    });
    it('should log warnings/errors if they are returned, and try again with ignoreWarnings true', async function() {
      const edition = new Edition({ lastModifiedDate: 'date' });
      const log = new FileLog();

      edition.related.schedule = jest
        .fn()
        .mockRejectedValueOnce({
          response: {
            data: {
              errors: [
                {
                  level: 'WARNING',
                  code: 'EDITION_SCHEDULE_OVERLAP',
                  message: 'Edition Schedule Overlap. Please try again later.',
                  overlaps: [
                    {
                      editionId: 'edition-id',
                      name: 'Test schedule edition',
                      start: '2022-01-07T15:31:47.337Z'
                    }
                  ]
                },
                {
                  level: 'WARNING',
                  code: 'EDITION_CONTAINS_SLOT_COLLISIONS',
                  message: 'Edition contains slots that collide with other editions.'
                },
                {
                  level: 'ERROR',
                  code: 'FAKE_ERROR',
                  message: 'This is an error.'
                }
              ]
            }
          }
        })
        .mockResolvedValueOnce({}); // Second call is resolved.

      await importModule.scheduleEdition(edition, log);

      expect(edition.related.schedule).toHaveBeenCalledTimes(2);
      expect(edition.related.schedule).toHaveBeenNthCalledWith(1, false, 'date');
      expect(edition.related.schedule).toHaveBeenNthCalledWith(2, true, 'date');
      expect(log.accessGroup).toMatchInlineSnapshot(`
Array [
  Object {
    "action": "WARNING",
    "comment": false,
    "data": "",
  },
  Object {
    "comment": true,
    "data": "WARNING: EDITION_SCHEDULE_OVERLAP: Edition Schedule Overlap. Please try again later. (Test schedule edition - edition-id 2022-01-07T15:31:47.337Z)",
  },
  Object {
    "action": "WARNING",
    "comment": false,
    "data": "",
  },
  Object {
    "comment": true,
    "data": "WARNING: EDITION_CONTAINS_SLOT_COLLISIONS: Edition contains slots that collide with other editions.",
  },
  Object {
    "action": "ERROR",
    "comment": false,
    "data": "",
  },
  Object {
    "comment": true,
    "data": "ERROR: FAKE_ERROR: This is an error.",
  },
]
`);
    });
  });

  describe('rewriteSnapshots tests', function() {
    it('should create new snapshots if no mapping is present, and use existing when it is', async function() {
      const { mockSnapshotCreate } = mockValues({});

      const { hub, log, mapping } = await commonMock();

      mapping.registerContentItem('item1', 'realItem1');
      mapping.registerContentItem('item2', 'realItem2');

      mapping.registerSnapshot('snap2', 'existingSnap');

      const content = {
        label: 'example',
        body: {
          _meta: {
            name: 'example',
            schema: 'https://amplience.com/example.json'
          },
          chooser: [
            {
              _meta: {
                schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link',
                locked: false,
                rootContentItemId: 'item1'
              },
              contentType: 'https://amplience.com/example.json',
              id: 'snap1'
            },
            {
              _meta: {
                schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link',
                locked: false,
                rootContentItemId: 'item2'
              },
              contentType: 'https://amplience.com/example.json',
              id: 'snap2'
            }
          ]
        }
      };

      (mockSnapshotCreate as jest.Mock).mockResolvedValue({ snapshots: [new Snapshot({ id: 'newSnap' })] });

      await importModule.rewriteSnapshots(content, mapping, hub, log);

      expect(mockSnapshotCreate).toHaveBeenCalledTimes(1);
      expect((mockSnapshotCreate as jest.Mock).mock.calls[0][0]).toMatchInlineSnapshot(`
        Array [
          Object {
            "comment": "",
            "contentRoot": "realItem1",
            "createdFrom": "content-item",
            "type": "GENERATED",
          },
        ]
      `);
      expect(mapping.getSnapshot('snap1')).toEqual('newSnap');
      expect(content.body.chooser[0].id).toEqual('newSnap');
      expect(content.body.chooser[0]._meta.rootContentItemId).toEqual('realItem1');
      expect(content.body.chooser[1].id).toEqual('existingSnap');
      expect(content.body.chooser[1]._meta.rootContentItemId).toEqual('realItem2');
    });

    it('should not create snapshots when content has no references', async function() {
      const { mockSnapshotCreate } = mockValues({});

      const { hub, log, mapping } = await commonMock();

      const content = {
        label: 'example',
        body: {
          _meta: {
            name: 'example',
            schema: 'https://amplience.com/example.json'
          }
        }
      };

      await importModule.rewriteSnapshots(content, mapping, hub, log);

      expect(mockSnapshotCreate).toHaveBeenCalledTimes(0);
    });
  });

  describe('importSlots tests', function() {
    it('should look up existing slot from mapping if present, and update it', async function() {
      mockValues({});

      const realSlot = new EditionSlot({ id: 'id-2', content: 'updated' });
      realSlot.related.content = jest.fn().mockResolvedValue(realSlot);

      const { hub, argv, log, mapping } = await commonMock();

      mapping.registerSlot('id-1', 'id-2');

      const rewriteSnapshots = jest.spyOn(importModule, 'rewriteSnapshots').mockResolvedValue(false);
      const importTest = [
        new EditionSlot({
          id: 'id-1',
          content: '{ "content": "test" }'
        })
      ];

      const realEdition = new Edition();
      realEdition.related.slots.list = jest.fn().mockResolvedValue(new MockPage(EditionSlot, [realSlot]));

      const result = await importSlots(importTest, mapping, hub, realEdition, argv, log);

      expect(result).toBeFalsy(); // rewriteSnapshots returns false.

      expect(realEdition.related.slots.list).toHaveBeenCalledTimes(1);
      expect(realSlot.related.content).toHaveBeenCalledTimes(1);

      expect(rewriteSnapshots).toHaveBeenCalledWith('{ "content": "test" }', mapping, hub, log);
    });

    it('should look up original id if no mapping present and originalIds set', async function() {
      mockValues({});

      const realSlot = new EditionSlot({ id: 'id-1', content: 'updated' });
      realSlot.related.content = jest.fn().mockResolvedValue(realSlot);

      const { hub, argv, log, mapping } = await commonMock({ originalIds: true });

      const rewriteSnapshots = jest.spyOn(importModule, 'rewriteSnapshots').mockResolvedValue(false);
      const importTest = [
        new EditionSlot({
          id: 'id-1',
          content: '{ "content": "test" }'
        })
      ];

      const realEdition = new Edition();
      realEdition.related.slots.list = jest.fn().mockResolvedValue(new MockPage(EditionSlot, [realSlot]));

      await importSlots(importTest, mapping, hub, realEdition, argv, log);

      expect(realEdition.related.slots.list).toHaveBeenCalledTimes(1);
      expect(realSlot.related.content).toHaveBeenCalledTimes(1);

      expect(rewriteSnapshots).toHaveBeenCalledWith('{ "content": "test" }', mapping, hub, log);
    });

    it('should create a new slot if no existing one is found', async function() {
      mockValues({});

      const realSlot = new EditionSlot({ id: 'id-new', content: 'updated' });
      realSlot.related.content = jest.fn().mockResolvedValue(realSlot);

      const { hub, argv, log, mapping } = await commonMock({ originalIds: false });

      const rewriteSnapshots = jest.spyOn(importModule, 'rewriteSnapshots').mockResolvedValue(false);
      const importTest = [
        new EditionSlot({
          id: 'id-1',
          content: '{ "content": "test" }'
        })
      ];

      const realEdition = new Edition();
      realEdition.related.slots.create = jest.fn().mockResolvedValue(new MockPage(EditionSlot, [realSlot]));
      realEdition.related.slots.list = jest.fn().mockResolvedValue(new MockPage(EditionSlot, []));

      await importSlots(importTest, mapping, hub, realEdition, argv, log);

      expect(realEdition.related.slots.list).toHaveBeenCalledTimes(1);
      expect(realEdition.related.slots.create).toHaveBeenCalledTimes(1);
      expect(realSlot.related.content).toHaveBeenCalledTimes(1);

      expect(mapping.getSlot('id-1')).toEqual('id-new');

      expect(rewriteSnapshots).toHaveBeenCalledWith('{ "content": "test" }', mapping, hub, log);
    });

    it('should return true if any rewriteSnapshots call returns true', async function() {
      mockValues({});

      const realSlot = new EditionSlot({ id: 'id-new', content: 'updated' });
      realSlot.related.content = jest.fn().mockResolvedValue(realSlot);

      const { hub, argv, log, mapping } = await commonMock({ originalIds: false });

      const rewriteSnapshots = jest
        .spyOn(importModule, 'rewriteSnapshots')
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      const importTest = [
        new EditionSlot({
          id: 'id-1',
          content: '{ "content": "test" }'
        }),
        new EditionSlot({
          id: 'id-2',
          content: '{ "content": "test" }'
        })
      ];

      const realEdition = new Edition();
      realEdition.related.slots.create = jest.fn().mockResolvedValue(new MockPage(EditionSlot, [realSlot]));
      realEdition.related.slots.list = jest.fn().mockResolvedValue(new MockPage(EditionSlot, []));

      const result = await importSlots(importTest, mapping, hub, realEdition, argv, log);

      expect(result).toBeTruthy();

      expect(realEdition.related.slots.list).toHaveBeenCalledTimes(1);
      expect(realEdition.related.slots.create).toHaveBeenCalledTimes(2);
      expect(realSlot.related.content).toHaveBeenCalledTimes(2);

      expect(rewriteSnapshots).toHaveBeenCalledTimes(2);
    });
  });

  describe('importEditions tests', function() {
    it('should look up existing edition from mapping if present, and update it', async function() {
      const { mockEditionGet, mockEditionUpdate } = mockValues({});

      const realEdition = new Edition({ id: 'id-2', name: 'updated' });
      (mockEditionUpdate as jest.Mock).mockResolvedValue(realEdition);

      const { client, hub, argv, log, mapping } = await commonMock();

      mapping.registerEdition('id-1', 'id-2');

      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue(false);
      const slots = [new EditionSlot({ id: 'slot1' }), new EditionSlot({ id: 'slot2' })];
      const importTest = [
        new EditionWithSlots({
          id: 'id-1',
          name: 'Edition',
          start: '0',
          end: '1',
          comment: 'comment',
          slots
        })
      ];

      const realEvent = new Event();

      await importEditions(importTest, mapping, client, hub, realEvent, argv, log);

      expect(mockEditionGet).toHaveBeenCalledWith('id-2');
      expect(mockEditionUpdate).toHaveBeenCalledTimes(1);

      expect(importSlots).toHaveBeenCalledWith(slots, mapping, hub, realEdition, argv, log);
    });

    it('should look up original id if no mapping present and originalIds set', async function() {
      const { mockEditionGet, mockEditionUpdate } = mockValues({});

      const realEdition = new Edition({ id: 'id-1', name: 'updated' });
      (mockEditionUpdate as jest.Mock).mockResolvedValue(realEdition);

      const { client, hub, argv, log, mapping } = await commonMock({ originalIds: true });

      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue(false);
      const slots = [new EditionSlot({ id: 'slot1' }), new EditionSlot({ id: 'slot2' })];
      const importTest = [
        new EditionWithSlots({
          id: 'id-1',
          name: 'Edition',
          start: '0',
          end: '1',
          comment: 'comment',
          slots
        })
      ];

      const realEvent = new Event();

      await importEditions(importTest, mapping, client, hub, realEvent, argv, log);

      expect(mockEditionGet).toHaveBeenCalledWith('id-1');
      expect(mockEditionUpdate).toHaveBeenCalledTimes(1);

      expect(importSlots).toHaveBeenCalledWith(slots, mapping, hub, realEdition, argv, log);
    });

    it('should create a new edition if no existing one is found', async function() {
      const { mockEditionGet, mockEditionUpdate } = mockValues({});

      const realEdition = new Edition({ id: 'id-1', name: 'updated' });
      const realEvent = new Event();
      realEvent.related.editions.create = jest.fn().mockResolvedValue(realEdition);

      const { client, hub, argv, log, mapping } = await commonMock({ originalIds: false });

      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue(false);
      const slots = [new EditionSlot({ id: 'slot1' }), new EditionSlot({ id: 'slot2' })];
      const importTest = [
        new EditionWithSlots({
          id: 'id-1',
          name: 'Edition',
          start: '0',
          end: '1',
          comment: 'comment',
          slots
        })
      ];

      await importEditions(importTest, mapping, client, hub, realEvent, argv, log);

      expect(mockEditionGet).not.toHaveBeenCalled();
      expect(mockEditionUpdate).not.toHaveBeenCalled();
      expect(realEvent.related.editions.create).toHaveBeenCalledTimes(1);

      expect(importSlots).toHaveBeenCalledWith(slots, mapping, hub, realEdition, argv, log);
    });

    it('should try schedule an edition if its scheduled status indicates that it was in the source', async function() {
      const { mockEditionGet, mockEditionUpdate } = mockValues({});

      const realEdition = new Edition({ id: 'id-2', name: 'updated', publishingStatus: PublishingStatus.DRAFT });
      (mockEditionUpdate as jest.Mock).mockResolvedValue(realEdition);

      const { client, hub, argv, log, mapping } = await commonMock();

      argv.schedule = true;
      mapping.registerEdition('id-1', 'id-2');

      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue(false);
      const scheduleEdition = jest.spyOn(importModule, 'scheduleEdition').mockResolvedValue();
      const skipSchedule = jest.spyOn(importModule, 'skipScheduleIfNeeded').mockReturnValue();
      const prepareEdition = jest.spyOn(importModule, 'prepareEditionForSchedule').mockResolvedValue();

      const slots = [new EditionSlot({ id: 'slot1' }), new EditionSlot({ id: 'slot2' })];
      const importTest = [
        new EditionWithSlots({
          id: 'id-1',
          name: 'Edition',
          start: dateOffset(10).toISOString(),
          end: dateOffset(15).toISOString(),
          publishingStatus: PublishingStatus.SCHEDULED,
          comment: 'comment',
          slots
        })
      ];

      const realEvent = new Event({
        start: dateOffset(5).toISOString(),
        end: dateOffset(20).toISOString()
      });

      await importEditions(importTest, mapping, client, hub, realEvent, argv, log);

      expect(mockEditionGet).toHaveBeenCalledWith('id-2');
      expect(mockEditionUpdate).toHaveBeenCalledTimes(1);

      expect(skipSchedule).toHaveBeenCalledWith(importTest[0], true);
      expect(prepareEdition).toHaveBeenCalledWith(expect.any(Edition), realEvent);

      expect(importSlots).toHaveBeenCalledWith(slots, mapping, hub, realEdition, argv, log);
      expect(scheduleEdition).toHaveBeenCalledWith(expect.any(Edition), log);
    });

    it('should try unschedule the existing edition if already scheduled, update if succeeded, reschedule', async function() {
      const { mockEditionGet, mockEditionUpdate, mockEditionUnschedule, mockSlotsList, mockEdition } = mockValues({
        status: PublishingStatus.SCHEDULED
      });

      const baseEdition = { id: 'id-2', name: 'updated', publishingStatus: PublishingStatus.DRAFT };
      (mockEditionGet as jest.Mock).mockReset();
      (mockEditionGet as jest.Mock).mockResolvedValueOnce(mockEdition);

      const newEdition = new Edition(baseEdition);
      newEdition.related.update = mockEdition.related.update;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newEdition as any).client = { fetchLinkedResource: mockSlotsList };
      (mockEditionGet as jest.Mock).mockResolvedValueOnce(newEdition);
      (mockEditionGet as jest.Mock).mockResolvedValueOnce(newEdition);
      (mockEditionUpdate as jest.Mock).mockResolvedValue(newEdition);
      (mockEditionUnschedule as jest.Mock).mockResolvedValue(undefined);

      const { client, hub, argv, log, mapping } = await commonMock();

      argv.schedule = true;
      mapping.registerEdition('id-1', 'id-2');

      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue(false);
      const scheduleEdition = jest.spyOn(importModule, 'scheduleEdition').mockResolvedValue();
      const skipSchedule = jest.spyOn(importModule, 'skipScheduleIfNeeded').mockReturnValue();
      const prepareEdition = jest.spyOn(importModule, 'prepareEditionForSchedule').mockResolvedValue();

      const slots = [new EditionSlot({ id: 'slot1' }), new EditionSlot({ id: 'slot2' })];
      const importTest = [
        new EditionWithSlots({
          id: 'id-1',
          name: 'Edition',
          start: dateOffset(10).toISOString(),
          end: dateOffset(15).toISOString(),
          publishingStatus: PublishingStatus.SCHEDULED,
          comment: 'comment',
          slots
        })
      ];

      const realEvent = new Event({
        start: dateOffset(5).toISOString(),
        end: dateOffset(20).toISOString()
      });

      await importEditions(importTest, mapping, client, hub, realEvent, argv, log);

      expect(mockEditionUnschedule).toHaveBeenCalled();
      expect(mockEditionGet).toHaveBeenNthCalledWith(1, 'id-2');
      expect(mockEditionGet).toHaveBeenNthCalledWith(3, 'id-2');
      expect(mockEditionUpdate).toHaveBeenCalledTimes(1);

      expect(skipSchedule).toHaveBeenCalledWith(importTest[0], true);
      expect(prepareEdition).toHaveBeenCalledWith(expect.any(Edition), realEvent);

      expect(importSlots).toHaveBeenCalledWith(slots, mapping, hub, newEdition, argv, log);
      expect(scheduleEdition).toHaveBeenCalledWith(expect.any(Edition), log);
    });

    it('should try unschedule the existing edition if already scheduled, do not update if failed', async function() {
      const { mockEditionGet, mockEditionUpdate, mockEditionUnschedule, mockSlotsList, mockEdition } = mockValues({
        status: PublishingStatus.SCHEDULED
      });

      const baseEdition = { id: 'id-2', name: 'updated', publishingStatus: PublishingStatus.DRAFT };
      (mockEditionGet as jest.Mock).mockReset();
      (mockEditionGet as jest.Mock).mockResolvedValueOnce(mockEdition);

      const newEdition = new Edition(baseEdition);
      newEdition.related.update = mockEdition.related.update;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newEdition as any).client = { fetchLinkedResource: mockSlotsList };
      (mockEditionGet as jest.Mock).mockResolvedValueOnce(newEdition);
      (mockEditionUnschedule as jest.Mock).mockRejectedValue(new Error('Unschedule Failed'));

      const { client, hub, argv, log, mapping } = await commonMock();

      argv.schedule = true;
      mapping.registerEdition('id-1', 'id-2');

      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue(false);
      const scheduleEdition = jest.spyOn(importModule, 'scheduleEdition').mockResolvedValue();
      const skipSchedule = jest.spyOn(importModule, 'skipScheduleIfNeeded').mockReturnValue();
      const prepareEdition = jest.spyOn(importModule, 'prepareEditionForSchedule').mockResolvedValue();

      const slots = [new EditionSlot({ id: 'slot1' }), new EditionSlot({ id: 'slot2' })];
      const importTest = [
        new EditionWithSlots({
          id: 'id-1',
          name: 'Edition',
          start: dateOffset(10).toISOString(),
          end: dateOffset(15).toISOString(),
          publishingStatus: PublishingStatus.SCHEDULED,
          comment: 'comment',
          slots
        })
      ];

      const realEvent = new Event({
        start: dateOffset(5).toISOString(),
        end: dateOffset(20).toISOString()
      });

      await importEditions(importTest, mapping, client, hub, realEvent, argv, log);

      expect(mockEditionUnschedule).toHaveBeenCalled();
      expect(mockEditionGet).toHaveBeenCalledWith('id-2');
      expect(mockEditionUpdate).not.toHaveBeenCalled();

      expect(skipSchedule).toHaveBeenCalledWith(importTest[0], true);
      expect(prepareEdition).not.toHaveBeenCalled();

      expect(importSlots).not.toHaveBeenCalled();
      expect(scheduleEdition).not.toHaveBeenCalled();
    });

    it('should not unschedule or update an edition published in the past', async function() {
      const { mockEditionGet, mockEditionUpdate, mockEditionUnschedule, mockSlotsList, mockEdition } = mockValues({
        status: PublishingStatus.PUBLISHED
      });

      const baseEdition = { id: 'id-2', name: 'updated', publishingStatus: PublishingStatus.DRAFT };
      (mockEditionGet as jest.Mock).mockReset();
      (mockEditionGet as jest.Mock).mockResolvedValueOnce(mockEdition);

      const newEdition = new Edition(baseEdition);
      newEdition.related.update = mockEdition.related.update;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newEdition as any).client = { fetchLinkedResource: mockSlotsList };
      (mockEditionGet as jest.Mock).mockResolvedValueOnce(newEdition);

      const { client, hub, argv, log, mapping } = await commonMock();

      argv.schedule = true;
      mapping.registerEdition('id-1', 'id-2');

      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue(false);
      const scheduleEdition = jest.spyOn(importModule, 'scheduleEdition').mockResolvedValue();
      const skipSchedule = jest.spyOn(importModule, 'skipScheduleIfNeeded').mockReturnValue();
      const prepareEdition = jest.spyOn(importModule, 'prepareEditionForSchedule').mockResolvedValue();

      const slots = [new EditionSlot({ id: 'slot1' }), new EditionSlot({ id: 'slot2' })];
      const importTest = [
        new EditionWithSlots({
          id: 'id-1',
          name: 'Edition',
          start: dateOffset(-20).toISOString(),
          end: dateOffset(-15).toISOString(),
          publishingStatus: PublishingStatus.PUBLISHED,
          comment: 'comment',
          slots
        })
      ];

      const realEvent = new Event({
        start: dateOffset(-25).toISOString(),
        end: dateOffset(-10).toISOString()
      });

      await importEditions(importTest, mapping, client, hub, realEvent, argv, log);

      expect(mockEditionGet).toHaveBeenCalledWith('id-2');
      expect(mockEditionUnschedule).not.toHaveBeenCalled();
      expect(mockEditionUpdate).not.toHaveBeenCalled();

      expect(skipSchedule).toHaveBeenCalledWith(importTest[0], true);
      expect(prepareEdition).not.toHaveBeenCalled();

      expect(importSlots).not.toHaveBeenCalled();
      expect(scheduleEdition).not.toHaveBeenCalled();
    });

    it('should not update edition if it is identical', async function() {
      const { mockEditionGet, mockEditionUpdate } = mockValues({});

      const realEdition = new Edition({ id: 'id-2', name: 'updated' });
      (mockEditionUpdate as jest.Mock).mockResolvedValue(realEdition);

      const { client, hub, argv, log, mapping } = await commonMock();

      mapping.registerEdition('id-1', 'id-2');

      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue(false);
      const shouldUpdate = jest.spyOn(importModule, 'shouldUpdateEdition').mockReturnValue(false);
      const slots = [new EditionSlot({ id: 'slot1' }), new EditionSlot({ id: 'slot2' })];
      const importTest = [
        new EditionWithSlots({
          id: 'id-1',
          name: 'Edition',
          start: '0',
          end: '1',
          comment: 'comment',
          slots
        })
      ];

      const realEvent = new Event();

      await importEditions(importTest, mapping, client, hub, realEvent, argv, log);

      expect(mockEditionGet).toHaveBeenCalledWith('id-2');
      expect(shouldUpdate).toHaveBeenCalled();
      expect(mockEditionUpdate).not.toHaveBeenCalled();

      expect(importSlots).not.toHaveBeenCalled();
    });

    it('should refetch and update editions so that their start dates are not in the past after snapshot creation when publishing', async function() {
      const { mockEditionGet, mockEditionUpdate } = mockValues({});

      const realEdition = new Edition({ id: 'id-2', name: 'updated', publishingStatus: PublishingStatus.DRAFT });
      (mockEditionUpdate as jest.Mock).mockResolvedValue(realEdition);

      const { client, hub, argv, log, mapping } = await commonMock();

      argv.schedule = true;
      mapping.registerEdition('id-1', 'id-2');

      // Indicate that the snapshot creation has happened.
      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue(true);
      const scheduleEdition = jest.spyOn(importModule, 'scheduleEdition').mockResolvedValue();
      const skipSchedule = jest.spyOn(importModule, 'skipScheduleIfNeeded').mockReturnValue();
      const prepareEdition = jest.spyOn(importModule, 'prepareEditionForSchedule').mockImplementation(async edition => {
        edition.start = dateOffset(5).toISOString();
      });

      const slots = [new EditionSlot({ id: 'slot1' }), new EditionSlot({ id: 'slot2' })];
      const importTest = [
        new EditionWithSlots({
          id: 'id-1',
          name: 'Edition',
          start: dateOffset(-10).toISOString(),
          end: dateOffset(15).toISOString(),
          publishingStatus: PublishingStatus.SCHEDULED,
          comment: 'comment',
          slots
        })
      ];

      const realEvent = new Event({
        start: dateOffset(-10).toISOString(),
        end: dateOffset(20).toISOString()
      });

      await importEditions(importTest, mapping, client, hub, realEvent, argv, log);

      expect(mockEditionGet).toHaveBeenCalledWith('id-2');
      expect(mockEditionUpdate).toHaveBeenCalledTimes(2);

      expect(skipSchedule).toHaveBeenCalledWith(importTest[0], true);
      expect(prepareEdition).toHaveBeenCalledWith(expect.any(Edition), realEvent);

      expect(importSlots).toHaveBeenCalledWith(slots, mapping, hub, realEdition, argv, log);
      expect(scheduleEdition).toHaveBeenCalledWith(expect.any(Edition), log);

      expect(importModule.prepareEditionForSchedule).toBeCalledTimes(2); // This should be called again just before schedule.
    });
  });

  describe('importEvents tests', function() {
    it('should look up existing event from mapping if present, and update it', async function() {
      const { mockGet, mockEventUpdate } = mockValues({});

      const realEvent = new Event({ id: 'id-2', name: 'updated' });
      (mockEventUpdate as jest.Mock).mockResolvedValue(realEvent);

      const { client, hub, argv, log, mapping } = await commonMock();

      mapping.registerEvent('id-1', 'id-2');

      const importEditions = jest.spyOn(importModule, 'importEditions').mockResolvedValue();
      const editions = [new EditionWithSlots({ id: 'edition1' }), new EditionWithSlots({ id: 'edition2' })];
      const importTest = [
        new EventWithEditions({
          id: 'id-1',
          name: 'event',
          start: '0',
          end: '1',
          comment: 'comment',
          brief: 'brief',
          editions
        })
      ];

      await importEvents(importTest, mapping, client, hub, argv, log);

      expect(mockGet).toHaveBeenCalledWith('id-2');
      expect(mockEventUpdate).toHaveBeenCalledTimes(1);

      expect(importEditions).toHaveBeenCalledWith(editions, mapping, client, hub, realEvent, argv, log);
    });

    it('should look up original id if no mapping present and originalIds set', async function() {
      const { mockGet, mockEventUpdate } = mockValues({});

      const realEvent = new Event({ id: 'id-1', name: 'updated' });
      (mockEventUpdate as jest.Mock).mockResolvedValue(realEvent);

      const { client, hub, argv, log, mapping } = await commonMock({ originalIds: true });

      const importEditions = jest.spyOn(importModule, 'importEditions').mockResolvedValue();
      const editions = [new EditionWithSlots({ id: 'edition1' }), new EditionWithSlots({ id: 'edition2' })];
      const importTest = [
        new EventWithEditions({
          id: 'id-1',
          name: 'event',
          start: '0',
          end: '1',
          comment: 'comment',
          brief: 'brief',
          editions
        })
      ];

      await importEvents(importTest, mapping, client, hub, argv, log);

      expect(mockGet).toHaveBeenCalledWith('id-1');
      expect(mockEventUpdate).toHaveBeenCalledTimes(1);

      expect(importEditions).toHaveBeenCalledWith(editions, mapping, client, hub, realEvent, argv, log);
    });

    it('should create a new event if no existing one is found', async function() {
      const { mockGet, mockEventCreate, mockEventUpdate } = mockValues({});

      const realEvent = new Event({ id: 'new-id', name: 'updated' });
      (mockEventCreate as jest.Mock).mockResolvedValue(realEvent);

      const { client, hub, argv, log, mapping } = await commonMock({ originalIds: false });

      const importEditions = jest.spyOn(importModule, 'importEditions').mockResolvedValue();
      const editions = [new EditionWithSlots({ id: 'edition1' }), new EditionWithSlots({ id: 'edition2' })];
      const importTest = [
        new EventWithEditions({
          id: 'id-1',
          name: 'event',
          start: '0',
          end: '1',
          comment: 'comment',
          brief: 'brief',
          editions
        })
      ];

      await importEvents(importTest, mapping, client, hub, argv, log);

      expect(mockGet).not.toHaveBeenCalled();
      expect(mockEventUpdate).toHaveBeenCalledTimes(0);
      expect(mockEventCreate).toHaveBeenCalledTimes(1);

      expect(mapping.getEvent('id-1')).toEqual('new-id');

      expect(importEditions).toHaveBeenCalledWith(editions, mapping, client, hub, realEvent, argv, log);
    });
  });

  describe('trySaveMapping tests', function() {
    it('should save a given mapping file', async function() {
      const log = new FileLog();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fakeMapping: any = {
        save: jest.fn().mockResolvedValue(true)
      };

      await trySaveMapping('file.txt', fakeMapping as ContentMapping, log);

      expect(fakeMapping.save).toHaveBeenCalledWith('file.txt');
      expect(log.accessGroup.length).toEqual(0);
    });

    it('should log an error if mapping save fails', async function() {
      const log = new FileLog();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fakeMapping: any = {
        save: jest.fn().mockRejectedValue('error')
      };

      await trySaveMapping('file.txt', fakeMapping as ContentMapping, log);

      expect(fakeMapping.save).toHaveBeenCalledWith('file.txt');
      expect(log.accessGroup.length).toEqual(1);
      expect(log.accessGroup[0]).toMatchInlineSnapshot(`
        Object {
          "comment": true,
          "data": "Failed to save the mapping. error",
        }
      `);
    });

    it('should do nothing for an undefined mapFile', async function() {
      const log = new FileLog();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fakeMapping: any = {
        save: jest.fn().mockRejectedValue('error')
      };

      await trySaveMapping(undefined, fakeMapping, log);

      expect(log.accessGroup.length).toEqual(0);
      expect(fakeMapping.save).not.toHaveBeenCalled();
    });
  });
});
