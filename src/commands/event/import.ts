import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import {
  DynamicContent,
  Event,
  Edition,
  EditionSlot,
  Hub,
  ContentRepository,
  Snapshot,
  SnapshotType
} from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { loadJsonFromDirectory } from '../../services/import.service';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { ImportEventBuilderOptions } from '../../interfaces/import-event-builder-options.interface';
import { EditionWithSlots, EventWithEditions } from './export';
import { ContentMapping } from '../../common/content-mapping';
import { join } from 'path';
import { FileLog } from '../../common/file-log';
import {
  ContentDependancy,
  ContentDependancyTree,
  DependancyContentTypeSchema
} from '../../common/content-item/content-dependancy-tree';
import { SnapshotCreator } from 'dc-management-sdk-js/build/main/lib/model/SnapshotCreator';

export const command = 'import <dir>';

export const desc = 'Import Events';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('event', 'import', platform);

export const getDefaultMappingPath = (name: string, platform: string = process.platform): string => {
  return join(
    process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname,
    '.amplience',
    `imports/`,
    `${name}.json`
  );
};

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Directory containing Events',
      type: 'string'
    })

    .option('mapFile', {
      type: 'string',
      describe:
        'Mapping file to use when updating content that already exists. Updated with any new mappings that are generated. If not present, will be created.'
    })

    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'Overwrite existing events, editions, slots and snapshots without asking.'
    })

    .option('originalIds', {
      type: 'boolean',
      boolean: true,
      describe: 'Use original ids'
    })

    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: createLog
    });
};

interface SlotDependencyMeta {
  name: string;
  rootContentItemId: string;
  locked: boolean;
  schema: DependancyContentTypeSchema;
}

interface SlotDependency extends ContentDependancy {
  _meta: SlotDependencyMeta;
}

export const rewriteSnapshots = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any,
  mapping: ContentMapping,
  hub: Hub,
  log: FileLog
): Promise<void> => {
  // Search for links/references in the slot content.
  const dummyRepo = new ContentRepository();
  const tree = new ContentDependancyTree([{ repo: dummyRepo, content }], new ContentMapping());

  const dependencies = tree.all[0].dependancies;

  for (const dep of dependencies) {
    const entry = dep.dependancy as SlotDependency;

    // Try find the snapshot in the mapping
    let snapshotId = mapping.getSnapshot(entry.id);
    const itemId = mapping.getContentItem(entry._meta.rootContentItemId) || entry._meta.rootContentItemId;

    if (snapshotId == null) {
      // Create a new snapshot based off of the current content state
      const result = await hub.related.snapshots.create([
        new Snapshot({
          contentRoot: itemId,
          comment: '',
          createdFrom: SnapshotCreator.ContentItem,
          type: SnapshotType.GENERATED
        })
      ]);

      const snapshot = result.snapshots[0];

      snapshotId = snapshot.id as string;

      mapping.registerSnapshot(entry.id as string, snapshotId);

      log.addAction('SNAPSHOT-CREATE', snapshotId);
    }

    dep.dependancy.id = snapshotId;
    entry._meta.rootContentItemId = itemId;
  }
};

export const importSlots = async (
  slots: EditionSlot[],
  mapping: ContentMapping,
  hub: Hub,
  edition: Edition,
  argv: ImportEventBuilderOptions,
  log: FileLog
): Promise<void> => {
  const editionSlots = await paginator(edition.related.slots.list);

  for (const slot of slots) {
    let realSlot: EditionSlot | undefined = undefined;

    // Attempt to get the existing edition, if present.
    const slotId = mapping.getSlot(slot.id);

    if (slotId == null) {
      if (argv.originalIds && slot.id) {
        // Look up the original ID.
        realSlot = editionSlots.find(editionSlot => editionSlot.id === slot.id);
      }
    } else {
      // Look up the mapped ID.
      realSlot = editionSlots.find(editionSlot => editionSlot.id === slotId);
    }

    // Attempt to link to existing content item
    const itemId = mapping.getContentItem(slot.slotId) || (slot.slotId as string);

    const updated = realSlot != null;

    if (realSlot == null) {
      // Create a new slot based off of the file.
      const slotPage = await edition.related.slots.create([{ slot: itemId }]);

      const items = slotPage.getItems();

      realSlot = items[0];

      mapping.registerSlot(slot.id as string, realSlot.id as string);
    }

    // Update the existing slot based off of the file.
    await rewriteSnapshots(slot.content, mapping, hub, log);

    realSlot = await realSlot.related.content(slot.content);

    log.addComment(`${updated ? 'Updated' : 'Created'} slot ${realSlot.slotId}.`);
    log.addAction(`SLOT-${updated ? 'UPDATE' : 'CREATE'}`, realSlot.id as string);
  }
};

export const importEditions = async (
  editions: EditionWithSlots[],
  mapping: ContentMapping,
  client: DynamicContent,
  hub: Hub,
  event: Event,
  argv: ImportEventBuilderOptions,
  log: FileLog
): Promise<void> => {
  for (const edition of editions) {
    let realEdition: Edition | null = null;

    // Attempt to get the existing edition, if present.
    const editionId = mapping.getEdition(edition.id);

    if (editionId == null) {
      if (argv.originalIds && edition.id) {
        // Look up the original ID.
        realEdition = await client.editions.get(edition.id);
      }
    } else {
      // Look up the mapped ID.
      realEdition = await client.editions.get(editionId);
    }

    const filteredEdition = new Edition({
      name: edition.name,
      start: edition.start,
      end: edition.end,
      comment: edition.comment,
      activeEndDate: edition.activeEndDate
    });

    if (realEdition == null) {
      // Create a new edition based off of the file.
      realEdition = await event.related.editions.create(filteredEdition);

      log.addComment(`Created edition ${realEdition.name}.`);
      log.addAction('EDITION-CREATE', realEdition.id as string);

      mapping.registerEdition(edition.id as string, realEdition.id as string);
    } else {
      // Update the existing edition based off of the file.
      realEdition = await realEdition.related.update(filteredEdition);

      log.addComment(`Updated edition ${realEdition.name}.`);
      log.addAction('EDITION-UPDATE', realEdition.id as string);
    }

    // Attempt to create slots
    await importSlots(edition.slots, mapping, hub, realEdition, argv, log);
  }
};

export const importEvents = async (
  events: EventWithEditions[],
  mapping: ContentMapping,
  client: DynamicContent,
  hub: Hub,
  argv: ImportEventBuilderOptions,
  log: FileLog
): Promise<void> => {
  for (const event of events) {
    let realEvent: Event | null = null;
    // Attempt to get the existing event, if present.

    const eventId = mapping.getEvent(event.id);

    if (eventId == null) {
      if (argv.originalIds && event.id) {
        // Look up the original ID.
        realEvent = await client.events.get(event.id);
      }
    } else {
      // Look up the mapped ID.
      realEvent = await client.events.get(eventId);
    }

    const filteredEvent = new Event({
      name: event.name,
      start: event.start,
      end: event.end,
      comment: event.comment,
      brief: event.brief
    });

    if (realEvent == null) {
      // Create a new event based off of the file.
      realEvent = await hub.related.events.create(filteredEvent);

      log.addComment(`Created event ${realEvent.name}.`);
      log.addAction('EVENT-CREATE', realEvent.id as string);

      mapping.registerEvent(event.id as string, realEvent.id as string);
    } else {
      // Update the existing event based off of the file.
      realEvent = await realEvent.related.update(filteredEvent);

      log.addComment(`Updated event ${realEvent.name}.`);
      log.addAction('EVENT-UPDATE', realEvent.id as string);
    }

    // Attempt to create editions
    await importEditions(event.editions, mapping, client, hub, realEvent, argv, log);
  }
};

export const trySaveMapping = async (
  mapFile: string | undefined,
  mapping: ContentMapping,
  log: FileLog
): Promise<void> => {
  if (mapFile != null) {
    try {
      await mapping.save(mapFile);
    } catch (e) {
      log.appendLine(`Failed to save the mapping. ${e.toString()}`);
    }
  }
};

export const handler = async (argv: Arguments<ImportEventBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, logFile } = argv;

  const client = dynamicContentClientFactory(argv);
  const log = logFile.open();

  const hub = await client.hubs.get(argv.hubId);

  const events = await loadJsonFromDirectory<EventWithEditions>(dir, EventWithEditions);

  const importTitle = `hub-${hub.id}`;
  const mapFile = argv.mapFile || getDefaultMappingPath(importTitle);

  const mapping = new ContentMapping();
  if (await mapping.load(mapFile)) {
    log.appendLine(`Existing mapping loaded from '${mapFile}', changes will be saved back to it.`);
  } else {
    log.appendLine(`Creating new mapping file at '${mapFile}'.`);
  }

  await importEvents(Object.values(events), mapping, client, hub, argv, log);

  await trySaveMapping(mapFile, mapping, log);

  log.appendLine('Done.');

  await log.close();
};
