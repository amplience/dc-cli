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
  SnapshotType,
  PublishingStatus
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
import { isEqual } from 'lodash';
import { dateMax, dateOffset, sortByEndDate, TimeRange } from '../../common/import/date-helpers';
import { EditionScheduleStatus } from '../../common/dc-management-sdk-js/event-schedule-error';

export const InstantSecondsAllowance = 5;
export const EditionSecondsAllowance = 5;
export const EventSecondsAllowance = 60;
export const ScheduleSecondsAllowance = 5;

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

    .option('acceptSnapshotLimits', {
      type: 'boolean',
      boolean: true,
      describe:
        'Must be passed to use the event import command. Only use this command if you fully understand its limitations.'
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

    .option('schedule', {
      type: 'boolean',
      boolean: true,
      describe:
        'Schedule events in the destination repo if they are scheduled in the source. If any new or updated scheduled events started in the past, they will be moved to happen at the time of import. If they ended in the past, they will be skipped by default.'
    })

    .option('catchup', {
      type: 'boolean',
      boolean: true,
      describe: 'Scheduling events that ended in the past will move to the current date, so that their publishes run.'
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

export const boundTimeRange = (realRange: TimeRange, range: TimeRange): void => {
  // Only update the resource start time if it is in the future, and less than existing.
  // Only update the resource end time if it is greater than existing.
  const eventStart = new Date(range.start as string);
  const realEventStart = new Date(range.start as string);
  const nowOffset = dateOffset(InstantSecondsAllowance);

  if (new Date(range.end as string) < new Date(realRange.end as string)) {
    range.end = realRange.end;
  }

  if (eventStart > realEventStart || realEventStart < nowOffset) {
    range.start = realRange.start;
  }
};

export const shouldUpdateSlot = (realSlot: EditionSlot, slot: EditionSlot): boolean => {
  return !isEqual(slot.content, realSlot.content);
};

export const shouldUpdateEvent = (realEvent: Event, event: Event): boolean => {
  boundTimeRange(realEvent, event);

  return (
    event.name !== realEvent.name ||
    event.brief !== realEvent.brief ||
    event.comment !== realEvent.comment ||
    event.start !== realEvent.start ||
    event.end !== realEvent.end
  );
};

export const shouldUpdateEdition = (
  realEdition: Edition,
  realSlots: EditionSlot[],
  edition: EditionWithSlots
): boolean => {
  boundTimeRange(realEdition, edition);

  return (
    edition.name !== realEdition.name ||
    edition.start !== realEdition.start ||
    edition.end !== realEdition.end ||
    edition.comment !== realEdition.comment ||
    edition.activeEndDate !== realEdition.activeEndDate ||
    edition.slots.length != realSlots.length ||
    edition.slots.map((x, i) => shouldUpdateSlot(x, realSlots[i])).reduce((a, b) => a || b, false)
  );
};

export const rewriteSnapshots = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any,
  mapping: ContentMapping,
  hub: Hub,
  log: FileLog
): Promise<boolean> => {
  // Search for links/references in the slot content.
  const dummyRepo = new ContentRepository();
  const tree = new ContentDependancyTree([{ repo: dummyRepo, content }], new ContentMapping());

  const dependencies = tree.all[0].dependancies;

  let snapshotCreated = false;

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
      snapshotCreated = true;
    }

    dep.dependancy.id = snapshotId;
    entry._meta.rootContentItemId = itemId;
  }

  return snapshotCreated;
};

export const importSlots = async (
  slots: EditionSlot[],
  mapping: ContentMapping,
  hub: Hub,
  edition: Edition,
  argv: ImportEventBuilderOptions,
  log: FileLog
): Promise<boolean> => {
  const editionSlots = await paginator(edition.related.slots.list);
  let snapshot = false;

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
    snapshot = (await rewriteSnapshots(slot.content, mapping, hub, log)) || snapshot;

    realSlot = await realSlot.related.content(slot.content);

    log.addComment(`${updated ? 'Updated' : 'Created'} slot ${realSlot.slotId}.`);
    log.addAction(`SLOT-${updated ? 'UPDATE' : 'CREATE'}`, realSlot.id as string);
  }

  return snapshot;
};

export const isScheduled = (edition: Edition): boolean =>
  edition.publishingStatus === PublishingStatus.PUBLISHED ||
  edition.publishingStatus === PublishingStatus.PUBLISHING ||
  edition.publishingStatus === PublishingStatus.SCHEDULING ||
  edition.publishingStatus === PublishingStatus.SCHEDULED;

export const moveDateToFuture = async (date: string, event: Event, offset: number): Promise<string> => {
  const newDate = dateMax(new Date(date as string), dateOffset(offset));

  if (newDate > new Date(event.end as string)) {
    event.end = dateMax(dateOffset(EventSecondsAllowance), newDate).toISOString();

    await event.related.update(event);
  }

  return newDate.toISOString();
};

export const prepareEditionForSchedule = async (edition: Edition, event: Event, force = false): Promise<void> => {
  if (force || isScheduled(edition)) {
    // This edition must start in the future for it to be scheduled.
    edition.start = await moveDateToFuture(edition.start as string, event, EditionSecondsAllowance);
    edition.end = await moveDateToFuture(edition.end as string, event, ScheduleSecondsAllowance);
  }
};

export const scheduleEdition = async (edition: Edition, log: FileLog): Promise<void> => {
  try {
    await edition.related.schedule(false, edition.lastModifiedDate);
  } catch (e) {
    if (e.response && e.response.data && typeof e.response.data === 'object') {
      // Attempt to parse the response data.

      const warning = new EditionScheduleStatus(e.response.data);

      if (warning.errors) {
        for (const error of warning.errors) {
          if (error.level === 'WARNING') {
            let message = `${error.code}: ${error.message}`;

            if (error.overlaps) {
              message += ` (${error.overlaps
                .map(overlap => `${overlap.name} - ${overlap.editionId} ${overlap.start}`)
                .join(', ')})`;
            }

            log.warn(message);
          } else {
            log.error(`${error.code}: ${error.message}`);
          }
        }

        // Errors the second time will be thrown (ignoreWarnings is passed).
        await edition.related.schedule(true, edition.lastModifiedDate);
      }
    } else {
      throw e;
    }
  }
};

export const skipScheduleIfNeeded = (edition: Edition, catchup: boolean): void => {
  if (!catchup && isScheduled(edition) && new Date(edition.end as string) < new Date()) {
    // Skip publish of events fully in the past, if catchup events are not to be created.
    edition.publishingStatus = PublishingStatus.DRAFT;
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
      activeEndDate: edition.activeEndDate,
      publishingStatus: edition.publishingStatus
    });

    let update = true;
    let schedule = argv.schedule;

    skipScheduleIfNeeded(edition, argv.catchup);

    if (realEdition == null) {
      // Create a new edition based off of the file.
      await prepareEditionForSchedule(filteredEdition, event);

      realEdition = await event.related.editions.create(filteredEdition);

      log.addComment(`Created edition ${realEdition.name}.`);
      log.addAction('EDITION-CREATE', realEdition.id as string);

      mapping.registerEdition(edition.id as string, realEdition.id as string);
    } else {
      const slots = await paginator(realEdition.related.slots.list);

      if (
        shouldUpdateEdition(realEdition, slots, edition) ||
        (schedule && !isScheduled(realEdition) && isScheduled(edition))
      ) {
        // If the edition has already published, it cannot be modified.
        // Copy back start/end in case they were modified above.
        filteredEdition.start = edition.start;
        filteredEdition.end = edition.end;

        if (
          realEdition.publishingStatus == PublishingStatus.SCHEDULED ||
          realEdition.publishingStatus == PublishingStatus.SCHEDULING
        ) {
          // If the edition is scheduled, it must first be unscheduled.
          try {
            await realEdition.related.unschedule();
            realEdition.publishingStatus = PublishingStatus.UNSCHEDULING;
            schedule = true; // Must reschedule after update.

            // Must fetch the edition again to get the update action
            while (realEdition.publishingStatus === PublishingStatus.UNSCHEDULING) {
              realEdition = await client.editions.get(realEdition.id as string);
            }
          } catch {
            update = false; // Can't update, as we weren't able to unschedule.
          }
        } else if (isScheduled(realEdition)) {
          update = false; // Can't update, as the edition was already published.
        }

        if (update) {
          await prepareEditionForSchedule(filteredEdition, event);

          // Update the existing edition based off of the file.
          realEdition = await realEdition.related.update(filteredEdition);

          log.addComment(`Updated edition ${realEdition.name}.`);
          log.addAction('EDITION-UPDATE', realEdition.id as string);
        } else {
          log.appendLine(`Skipped updating ${realEdition.name}, as it has already published.`);
        }
      } else {
        update = false;
      }
    }

    let createdSnapshots = false;

    if (update) {
      // Attempt to create/update slots.
      createdSnapshots = await importSlots(edition.slots, mapping, hub, realEdition, argv, log);
    }

    // If the original edition was scheduled, attempt to schedule the new one.
    if (schedule && !isScheduled(realEdition) && isScheduled(edition)) {
      if (update && edition.slots.length > 0) {
        // Refetch the edition to make sure it's up to date before scheduling.
        realEdition = await client.editions.get(realEdition.id as string);

        if (createdSnapshots) {
          // We might need to move the edition into the future again,
          // as creating snapshots may have taken more time than our scheduling grace period.
          const lastStart = realEdition.start;
          await prepareEditionForSchedule(realEdition, event, true);

          if (realEdition.start != lastStart) {
            realEdition = await realEdition.related.update(realEdition);
          }
        }
      }
      await scheduleEdition(realEdition, log);
    }
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
    } else if (shouldUpdateEvent(realEvent, event)) {
      // Update the existing event based off of the file.
      realEvent = await realEvent.related.update(filteredEvent);

      log.addComment(`Updated event ${realEvent.name}.`);
      log.addAction('EVENT-UPDATE', realEvent.id as string);
    }

    // Attempt to create editions
    await importEditions(sortByEndDate(event.editions), mapping, client, hub, realEvent, argv, log);
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
  const { dir, logFile, acceptSnapshotLimits } = argv;

  if (!acceptSnapshotLimits) {
    console.log(
      'Event import may result in a different state from the export due to snapshots of referenced content items being taken at the time of creation. Only use it if you fully understand its limitations. To use this command, pass the --acceptSnapshotLimits flag.'
    );
    return;
  }

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

  try {
    await importEvents(sortByEndDate(Object.values(events)), mapping, client, hub, argv, log);
  } catch (e) {
    log.error('Failed to import events.', e);
  }

  await trySaveMapping(mapFile, mapping, log);

  log.appendLine('Done.');

  await log.close();
};
