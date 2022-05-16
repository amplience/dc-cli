import {
  builder,
  command,
  handler,
  enrichEditions,
  enrichEvents,
  filterEvents,
  LOG_FILENAME,
  locateSnapshots,
  exportSnapshots
} from './export';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Event, Edition, EditionSlot, Page } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import { promisify } from 'util';
import { exists, readFile, readdirSync } from 'fs';
import paginator from '../../common/dc-management-sdk-js/paginator';

import rmdir from 'rimraf';
import * as facet from '../../common/filter/facet';
import * as exportService from '../../services/export.service';
import { FileLog, setVersion } from '../../common/file-log';
import { LogErrorLevel } from '../../common/archive/archive-log';

import { mockValues } from './event-test-helpers';
import { createLog } from '../../common/log-helpers';

setVersion('test-ver');

jest.mock('../../services/dynamic-content-client-factory');

jest.mock('../../common/filter/facet', () => ({
  relativeDate: jest
    .fn()
    .mockImplementation((relative: string) => jest.requireActual('../../common/filter/facet').relativeDate(relative))
}));

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('event export command', () => {
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
    hubId: 'hub-id'
  };

  it('should command should defined', function() {
    expect(command).toEqual('export <dir>');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Output directory for the exported Events.',
        type: 'string'
      });

      expect(spyOption).toHaveBeenCalledWith('id', {
        describe: 'Export a single event by ID, rather then fetching all of them.',
        type: 'string'
      });

      expect(spyOption).toHaveBeenCalledWith('fromDate', {
        describe:
          'Start date for filtering events. Either "NOW" or in the format "<number>:<unit>", example: "-7:DAYS".',
        type: 'string'
      });

      expect(spyOption).toHaveBeenCalledWith('toDate', {
        describe: 'To date for filtering events. Either "NOW" or in the format "<number>:<unit>", example: "-7:DAYS".',
        type: 'string'
      });

      expect(spyOption).toHaveBeenCalledWith('snapshots', {
        describe: 'Save content snapshots with events, in subfolder "snapshots/".',
        type: 'boolean',
        boolean: true
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
      await rimraf('temp/exportEvent/');
    });

    afterAll(async () => {
      await rimraf('temp/exportEvent/');
    });

    it('should list and export all editions', async () => {
      const { mockEventsList, mockEditionsList, mockSlotsList } = mockValues({});

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/exportEvent/all/',
        logFile: new FileLog('temp/exportEvent/all.log'),
        snapshots: false
      };
      await handler(argv);

      expect(mockEventsList).toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalledTimes(2);
      expect(mockSlotsList).toHaveBeenCalledTimes(2);

      const results = [
        await promisify(readFile)('temp/exportEvent/all/test1.json', { encoding: 'utf-8' }),
        await promisify(readFile)('temp/exportEvent/all/test2.json', { encoding: 'utf-8' })
      ];

      const log = await promisify(readFile)('temp/exportEvent/all.log', { encoding: 'utf-8' });

      expect(results).toMatchSnapshot();
      expect(log).toMatchSnapshot();
    });

    it('should list and export a single edition', async () => {
      const { mockEventsList, mockEditionsList, mockSlotsList, mockGet } = mockValues({});

      const argv = {
        ...yargArgs,
        ...config,
        id: 'item1',
        dir: 'temp/exportEvent/single/',
        logFile: new FileLog('temp/exportEvent/single.log'),
        snapshots: false
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalledWith('item1');
      expect(mockEventsList).not.toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalledTimes(1);
      expect(mockSlotsList).toHaveBeenCalledTimes(1);

      const results = [await promisify(readFile)('temp/exportEvent/single/test1.json', { encoding: 'utf-8' })];

      const log = await promisify(readFile)('temp/exportEvent/single.log', { encoding: 'utf-8' });

      expect(results).toMatchSnapshot();
      expect(log).toMatchSnapshot();
    });

    it('should pass from and to date parameters to filterEvents', async () => {
      const { mockEventsList, mockEditionsList, mockSlotsList } = mockValues({});

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/exportEvent/date/',
        logFile: new FileLog('temp/exportEvent/date.log'),
        fromDate: '-1:DAYS',
        toDate: '1:DAYS',
        snapshots: false
      };
      await handler(argv);

      expect((facet.relativeDate as jest.Mock).mock.calls).toMatchInlineSnapshot(`
        Array [
          Array [
            "-1:DAYS",
          ],
          Array [
            "1:DAYS",
          ],
        ]
      `);

      expect(mockEventsList).toHaveBeenCalled();
      expect(mockEditionsList).not.toHaveBeenCalled();
      expect(mockSlotsList).not.toHaveBeenCalled();

      const dirExists = await promisify(exists)('temp/exportEvent/date/');
      const log = await promisify(readFile)('temp/exportEvent/date.log', { encoding: 'utf-8' });

      expect(dirExists).toBeFalsy();
      expect(log).toMatchSnapshot();
    });

    it('should exit early if getting the hub fails', async () => {
      const { getHubMock, mockEventsList, mockEditionsList, mockSlotsList, mockGet } = mockValues({
        getEventError: true,
        getHubError: true
      });

      const argv = {
        ...yargArgs,
        ...config,
        id: 'missing',
        dir: 'temp/exportEvent/noHub/',
        logFile: new FileLog('temp/exportEvent/noHub.log'),
        snapshots: false
      };
      await handler(argv);

      expect(getHubMock).toHaveBeenCalled();
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockEventsList).not.toHaveBeenCalled();
      expect(mockEditionsList).not.toHaveBeenCalled();
      expect(mockSlotsList).not.toHaveBeenCalled();

      const dirExists = await promisify(exists)('temp/exportEvent/noHub/');
      const log = await promisify(readFile)('temp/exportEvent/noHub.log', { encoding: 'utf-8' });

      expect(dirExists).toBeFalsy();
      expect(log).toMatchSnapshot();
    });

    it('should log an error when getting a single event fails', async () => {
      const { mockEventsList, mockEditionsList, mockSlotsList, mockGet } = mockValues({ getEventError: true });

      const argv = {
        ...yargArgs,
        ...config,
        id: 'missing',
        dir: 'temp/exportEvent/singleError/',
        logFile: new FileLog('temp/exportEvent/singleError.log'),
        snapshots: false
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalledWith('missing');
      expect(mockEventsList).not.toHaveBeenCalled();
      expect(mockEditionsList).not.toHaveBeenCalled();
      expect(mockSlotsList).not.toHaveBeenCalled();

      const dirExists = await promisify(exists)('temp/exportEvent/singleError/');
      const log = await promisify(readFile)('temp/exportEvent/singleError.log', { encoding: 'utf-8' });

      expect(dirExists).toBeFalsy();
      expect(log).toMatchSnapshot();
    });

    it('should log an error when listing events fails', async () => {
      const { mockEventsList, mockEditionsList, mockSlotsList, mockGet } = mockValues({ listEventError: true });

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/exportEvent/listError/',
        logFile: new FileLog('temp/exportEvent/listError.log'),
        snapshots: false
      };
      await handler(argv);

      expect(mockGet).not.toHaveBeenCalled();
      expect(mockEventsList).toHaveBeenCalled();
      expect(mockEditionsList).not.toHaveBeenCalled();
      expect(mockSlotsList).not.toHaveBeenCalled();

      const dirExists = await promisify(exists)('temp/exportEvent/listError/');
      const log = await promisify(readFile)('temp/exportEvent/listError.log', { encoding: 'utf-8' });

      expect(dirExists).toBeFalsy();
      expect(log).toMatchSnapshot();
    });

    it('should export snapshots when --snapshots is provided', async () => {
      const {
        mockEventsList,
        mockEditionsList,
        mockSlotsList,
        mockGet,
        mockSnapshotGet,
        mockSnapshotItem
      } = mockValues({});

      const argv = {
        ...yargArgs,
        ...config,
        id: 'item1',
        dir: 'temp/exportEvent/snapshots/',
        logFile: new FileLog('temp/exportEvent/snapshots.log'),
        snapshots: true
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalledWith('item1');
      expect(mockEventsList).not.toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalledTimes(1);
      expect(mockSlotsList).toHaveBeenCalledTimes(1);
      expect(mockSnapshotGet).toHaveBeenCalledTimes(1);
      expect(mockSnapshotItem).toHaveBeenCalledTimes(1);

      const results = [
        await promisify(readFile)('temp/exportEvent/snapshots/test1.json', { encoding: 'utf-8' }),
        await promisify(readFile)('temp/exportEvent/snapshots/snapshots/snapshot1.json', { encoding: 'utf-8' })
      ];

      const log = await promisify(readFile)('temp/exportEvent/snapshots.log', { encoding: 'utf-8' });

      expect(results).toMatchSnapshot();
      expect(log).toMatchSnapshot();
    });

    it('should return event file name', async () => {
      const logFile = LOG_FILENAME();

      expect(logFile).toContain('event-export-<DATE>.log');
    });
  });

  describe('enrichEvents tests', () => {
    it('should request and populate editions for each of the provided events', async () => {
      const { mockEventsList, mockEditionsList } = mockValues({});

      const events = await paginator((mockEventsList as unknown) as () => Promise<Page<Event>>);

      await expect(enrichEvents(events)).resolves.toMatchSnapshot();

      expect(mockEditionsList).toHaveBeenCalledTimes(2);
    });

    it('should omit events when fetching their editions failed', async () => {
      const { mockEventsList, mockEditionsList } = mockValues({ listEditionError: true });

      const events = await paginator((mockEventsList as unknown) as () => Promise<Page<Event>>);

      const log = new FileLog();

      await expect(enrichEvents(events, log)).resolves.toEqual([]);

      expect(log.errorLevel).toEqual(LogErrorLevel.WARNING);
      expect(mockEditionsList).toHaveBeenCalledTimes(2);
    });

    it('should return empty array if no events provided', async () => {
      expect(enrichEvents([])).resolves.toEqual([]);
    });
  });

  describe('enrichEditions tests', () => {
    it('should request and populate slots for each of the provided editions', async () => {
      const { mockEditionsList, mockSlotsList } = mockValues({});

      const editions = await paginator((mockEditionsList as unknown) as () => Promise<Page<Edition>>);

      await expect(enrichEditions(editions)).resolves.toMatchSnapshot();

      expect(mockSlotsList).toHaveBeenCalledTimes(1);
    });

    it('should return empty array if no editions provided', async () => {
      expect(enrichEditions([])).resolves.toEqual([]);
    });
  });

  describe('filterEvents tests', () => {
    const testEvents = [
      new Event({ start: '2021-01-01T12:00:00.000Z', end: '2021-05-05T12:00:00.000Z' }),
      new Event({ start: '2021-04-04T12:00:00.000Z', end: '2021-06-06T12:00:00.000Z' }),
      new Event({ start: '2021-08-08T12:00:00.000Z', end: '2021-09-09T12:00:00.000Z' }),
      new Event({ start: '2021-01-01T12:00:00.000Z', end: '2021-10-10T12:00:00.000Z' })
    ];

    it('should return the input events if from and to are undefined', async () => {
      expect(filterEvents(testEvents, undefined, undefined)).toEqual(testEvents);
    });

    it('should filter out events from before the from date when provided', async () => {
      expect(filterEvents(testEvents, new Date('2021-08-08T12:00:00.000Z'), undefined)).toEqual(testEvents.slice(2));
    });

    it('should filter out events from after the to date when provided', async () => {
      expect(filterEvents(testEvents, undefined, new Date('2021-07-07T12:00:00.000Z'))).toEqual([
        testEvents[0],
        testEvents[1],
        testEvents[3]
      ]);
    });

    it('should filter out events outwith the from and to dates when both are provided', async () => {
      expect(
        filterEvents(testEvents, new Date('2021-05-06T12:00:00.000Z'), new Date('2021-07-07T12:00:00.000Z'))
      ).toEqual([testEvents[1], testEvents[3]]);
    });
  });

  describe('locateSnapshots tests', () => {
    it('should locate snapshots within the provided slots, alongside empty slots', async () => {
      const slots = [
        new EditionSlot({
          id: 'emptySlot',
          eventId: 'test1',
          editionId: 'ed1',
          content: { body: { _meta: { schema: 'http://schema.com/test.json', name: 'example-slot-test' } } },
          status: 'VALID',
          slotStatus: 'ACTIVE',
          contentTypeId: 'testType',
          slotId: 'slot1',
          slotLabel: 'example-slot-test',
          empty: true
        }),
        new EditionSlot({
          id: 'referencesSlot',
          eventId: 'test1',
          editionId: 'ed1',
          content: {
            label: 'references',
            body: {
              _meta: { schema: 'http://schema.com/test.json', name: 'example-slot-test' },
              array: [
                {
                  _meta: {
                    schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link',
                    rootContentItemId: 'content-item-1',
                    locked: true
                  },
                  contentType: 'http://schema.com/test.json',
                  id: 'snapshot1'
                }
              ],
              property: {
                _meta: {
                  schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-reference',
                  rootContentItemId: 'content-item-2',
                  locked: true
                },
                contentType: 'http://schema.com/test.json',
                id: 'snapshot2'
              },
              propertyNested: {
                property: {
                  _meta: {
                    schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link',
                    rootContentItemId: 'content-item-3',
                    locked: true
                  },
                  contentType: 'http://schema.com/test.json',
                  id: 'snapshot3'
                }
              }
            }
          },
          status: 'VALID',
          slotStatus: 'ACTIVE',
          contentTypeId: 'testType',
          slotId: 'slot2',
          slotLabel: 'example-slot-test2',
          empty: false
        }),
        new EditionSlot({
          id: 'referencesSlot',
          eventId: 'test1',
          editionId: 'ed1',
          content: {
            label: 'references',
            body: {
              _meta: { schema: 'http://schema.com/test.json', name: 'example-slot-test' },
              noReferences: 'none!'
            }
          },
          status: 'VALID',
          slotStatus: 'ACTIVE',
          contentTypeId: 'testType',
          slotId: 'slot3',
          slotLabel: 'example-slot-test3',
          empty: false
        }),
        new EditionSlot({
          id: 'referencesSlot',
          eventId: 'test1',
          editionId: 'ed1',
          content: {
            label: 'references',
            body: {
              _meta: { schema: 'http://schema.com/test.json', name: 'example-slot-test' },
              oneReference: {
                _meta: {
                  schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-reference',
                  rootContentItemId: 'content-item-2',
                  locked: true
                },
                contentType: 'http://schema.com/test.json',
                id: 'snapshot4'
              }
            }
          },
          status: 'VALID',
          slotStatus: 'ACTIVE',
          contentTypeId: 'testType',
          slotId: 'slot3',
          slotLabel: 'example-slot-test3',
          empty: false
        })
      ];

      const snapshots = new Set<string>();
      locateSnapshots(slots, snapshots);

      expect(Array.from(snapshots)).toEqual(['snapshot1', 'snapshot2', 'snapshot3', 'snapshot4']);
    });

    it('should not add snapshots when no slots are provided', async () => {
      const snapshots = new Set<string>();
      locateSnapshots([], snapshots);

      expect(snapshots.size).toEqual(0);
    });
  });

  describe('exportSnapshots tests', () => {
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    it('should export snapshots to a "snapshots" subfolder in the provided directory', async () => {
      const { mockSnapshotGet, mockSnapshotItem } = mockValues({});

      const client = await dynamicContentClientFactory(config);

      const log = new FileLog();

      await exportSnapshots(client, 'temp/exportSnapshot/snapshots', new Set(['snapshot1', 'snapshot2']), log);

      expect(mockSnapshotGet).toHaveBeenCalledTimes(2);
      expect(mockSnapshotItem).toHaveBeenCalledTimes(2);
      expect(log.errorLevel).toEqual(LogErrorLevel.NONE);

      const exportDir = readdirSync('temp/exportSnapshot/snapshots/snapshots');

      expect(exportDir).toMatchInlineSnapshot(`
        Array [
          "snapshot1.json",
          "snapshot2.json",
        ]
      `);
    });

    it('should warn and skip when the snapshot cannot be fetched', async () => {
      const { mockSnapshotGet, mockSnapshotItem } = mockValues({ getSnapshotError: true });

      const client = await dynamicContentClientFactory(config);

      const log = new FileLog();

      await exportSnapshots(client, 'temp/exportSnapshot/snapshotFail1', new Set(['snapshot1']), log);

      expect(mockSnapshotGet).toHaveBeenCalledWith('snapshot1');
      expect(mockSnapshotItem).not.toHaveBeenCalled();
      expect(readdirSync('temp/exportSnapshot/snapshotFail1/snapshots').length).toEqual(0);
      expect(log.errorLevel).toEqual(LogErrorLevel.WARNING);
    });

    it('should warn and skip when the snapshot cannot be saved', async () => {
      const { mockSnapshotGet, mockSnapshotItem } = mockValues({});

      jest.spyOn(exportService, 'writeJsonToFile').mockImplementation(() => {
        throw new Error('Error');
      });
      const client = await dynamicContentClientFactory(config);

      const log = new FileLog();

      await exportSnapshots(client, 'temp/exportSnapshot/snapshotFail2', new Set(['snapshot1']), log);

      expect(mockSnapshotGet).toHaveBeenCalledWith('snapshot1');
      expect(mockSnapshotItem).toHaveBeenCalledWith('content-item-1');
      expect(readdirSync('temp/exportSnapshot/snapshotFail2/snapshots').length).toEqual(0);
      expect(log.errorLevel).toEqual(LogErrorLevel.WARNING);
    });
  });
});
