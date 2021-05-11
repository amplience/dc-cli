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
import { Event, Edition, Hub, EditionSlot, Snapshot, DynamicContent } from 'dc-management-sdk-js';
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
    hubId: 'hub-id'
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
      await rimraf('temp/importEvent/');
    });

    afterAll(async () => {
      await rimraf('temp/importEvent/');
    });

    it('should call importEvents with the loaded events, then save the mapping', async function() {
      const { getHubMock } = mockValues({});

      const logFile = new FileLog();
      const argv = {
        ...yargArgs,
        ...config,
        logFile,
        dir: 'temp/importEvent/',
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
      expect(loadJsonFromDirectory as jest.Mock).toHaveBeenCalledWith('temp/importEvent/', EventWithEditions);

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
        mapFile: 'temp/importEvent/importEvent.json',
        dir: 'temp/importEvent/',
        originalIds: false
      };
      const event = new EventWithEditions({ id: 'id-1' });

      (loadJsonFromDirectory as jest.Mock).mockResolvedValue({
        'event1.json': event
      });

      const importEvents = jest.spyOn(importModule, 'importEvents').mockResolvedValue();
      const trySaveMapping = jest.spyOn(importModule, 'trySaveMapping').mockResolvedValue();
      const getDefaultMappingPath = jest.spyOn(importModule, 'getDefaultMappingPath');

      const existingMapping = new ContentMapping();
      await existingMapping.save(argv.mapFile);

      await handler(argv);

      expect(getHubMock).toHaveBeenCalledWith('hub-id'); //from returned hub
      expect(loadJsonFromDirectory as jest.Mock).toHaveBeenCalledWith('temp/importEvent/', EventWithEditions);

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

      const rewriteSnapshots = jest.spyOn(importModule, 'rewriteSnapshots').mockResolvedValue();
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

    it('should look up original id if no mapping present and originalIds set', async function() {
      mockValues({});

      const realSlot = new EditionSlot({ id: 'id-1', content: 'updated' });
      realSlot.related.content = jest.fn().mockResolvedValue(realSlot);

      const { hub, argv, log, mapping } = await commonMock({ originalIds: true });

      const rewriteSnapshots = jest.spyOn(importModule, 'rewriteSnapshots').mockResolvedValue();
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

      const rewriteSnapshots = jest.spyOn(importModule, 'rewriteSnapshots').mockResolvedValue();
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
  });

  describe('importEditions tests', function() {
    it('should look up existing edition from mapping if present, and update it', async function() {
      const { mockEditionGet, mockEditionUpdate } = mockValues({});

      const realEdition = new Edition({ id: 'id-2', name: 'updated' });
      (mockEditionUpdate as jest.Mock).mockResolvedValue(realEdition);

      const { client, hub, argv, log, mapping } = await commonMock();

      mapping.registerEdition('id-1', 'id-2');

      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue();
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

      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue();
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

      const importSlots = jest.spyOn(importModule, 'importSlots').mockResolvedValue();
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

  /*
  describe('handler tests', function() {});
  */
});
