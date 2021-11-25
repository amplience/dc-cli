import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentRepository, DynamicContent, Edition, EditionSlot, Event, Hub, Snapshot } from 'dc-management-sdk-js';
import { createStream } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { TableStream } from '../../interfaces/table.interface';
import chalk from 'chalk';
import {
  ExportResult,
  nothingExportedExit,
  promptToOverwriteExports,
  uniqueFilenamePath,
  writeJsonToFile
} from '../../services/export.service';
import { loadJsonFromDirectory } from '../../services/import.service';
import { ExportEventBuilderOptions } from '../../interfaces/export-event-builder-options.interface';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { relativeDate } from '../../common/filter/facet';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
import { ContentDependancyTree } from '../../common/content-item/content-dependancy-tree';
import { ContentMapping } from '../../common/content-mapping';
import { join } from 'path';

export const command = 'export <dir>';

export const desc = 'Export Events';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('event', 'export', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Output directory for the exported Events.',
      type: 'string'
    })
    .option('id', {
      describe: 'Export a single event by ID, rather then fetching all of them.',
      type: 'string'
    })
    .option('fromDate', {
      describe: 'Start date for filtering events. Either "NOW" or in the format "<number>:<unit>", example: "-7:DAYS".',
      type: 'string'
    })
    .option('toDate', {
      describe: 'To date for filtering events. Either "NOW" or in the format "<number>:<unit>", example: "-7:DAYS".',
      type: 'string'
    })
    .option('snapshots', {
      describe: 'Save content snapshots with events, in subfolder "snapshots/".',
      type: 'boolean',
      boolean: true
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: createLog
    });
};

interface ExportRecord {
  readonly filename: string;
  readonly status: ExportResult;
  readonly event: Event;
}

export class EditionWithSlots extends Edition {
  slots: EditionSlot[];
}

export class EventWithEditions extends Event {
  editions: EditionWithSlots[];
}

export const exportSnapshots = async (
  client: DynamicContent,
  outputDir: string,
  snapshots: Set<string>,
  log: FileLog
): Promise<void> => {
  const baseDir = join(outputDir, 'snapshots/');
  await ensureDirectoryExists(baseDir);

  log.appendLine(`Saving ${snapshots.size} snapshots to './snapshots/'.`);

  for (const id of snapshots) {
    log.appendLine(`Fetching snapshot ${id}.`);

    let snapshot: Snapshot;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let snapshotJson: any;
    try {
      snapshot = await client.snapshots.get(id);
      snapshotJson = snapshot.toJSON();

      const content = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (snapshotJson.rootContentItems as any[]).map((item: { id: string }) =>
          snapshot.related.snapshotContentItem(item.id)
        )
      );

      for (const item of content) {
        const itemTree = new ContentDependancyTree(
          [{ repo: new ContentRepository(), content: item }],
          new ContentMapping()
        );

        for (const subItem of itemTree.all[0].dependancies) {
          log.appendLine('... scanning item ' + subItem.dependancy.id + ' ' + subItem.dependancy._meta.schema);
          try {
            await snapshot.related.snapshotContentItem(subItem.dependancy.id as string);
            log.appendLine('yep');
          } catch {
            log.appendLine('nope!');
          }
        }
      }

      snapshotJson.content = content;
    } catch (e) {
      log.warn(`Could not fetch snapshot ${id}, continuing: `, e);
      continue;
    }

    const filename = join(baseDir, id + '.json');

    try {
      writeJsonToFile(filename, snapshotJson);
    } catch (e) {
      log.warn(`Could not write snapshot ${id}, continuing: `, e);
    }
  }
};

export const locateSnapshots = (slots: EditionSlot[], snapshots: Set<string>): void => {
  for (const slot of slots) {
    if (slot.content.body) {
      const item = { repo: new ContentRepository(), content: slot.content };
      const tree = new ContentDependancyTree([item], new ContentMapping());

      const dependencies = tree.all[0].dependancies;

      for (const link of dependencies) {
        if (link.dependancy.id) {
          snapshots.add(link.dependancy.id);
        }
      }
    }
  }
};

export const locateAndExportSnapshots = async (
  client: DynamicContent,
  outputDir: string,
  events: EventWithEditions[],
  log: FileLog
): Promise<void> => {
  const snapshots = new Set<string>();

  log.appendLine(`Scanning slots for snapshots.`);

  for (const event of events) {
    for (const edition of event.editions) {
      locateSnapshots(edition.slots, snapshots);
    }
  }

  await exportSnapshots(client, outputDir, snapshots, log);
};

export const enrichEditions = async (editions: Edition[]): Promise<EditionWithSlots[]> => {
  for (const edition of editions) {
    const withEditions = edition as EditionWithSlots;
    const slots = await paginator(edition.related.slots.list);
    withEditions.slots = slots;

    // SLOT todo
    // content.body contains the version of the slot that will be scheduled in its entirety.
    // this is simply a _meta.schema and _meta.name if the slot is empty,
    // but if it isn't, it contains the full slot contents (with no depth)
    // any links and references, however, have additional fields:
    //
    // <property>._meta.rootContentItemId - the true content id that the reference/link is pointing to
    // <property>._meta.locked - not sure
    // <property>._meta.schema - link or reference
    // <property>.id - this is NOT a content id, it's a snapshot ID of the content at the time it was selected by the content chooser.
    // <property>.contentType - type schema for the referenced content type
  }

  return editions as EditionWithSlots[];
};

export const enrichEvents = async (events: Event[], log?: FileLog): Promise<EventWithEditions[]> => {
  for (const event of events) {
    if (log) {
      log.appendLine(`Fetching ${event.name} with editions.`);
    }

    const withEditions = event as EventWithEditions;

    try {
      const editions = await paginator(event.related.editions.list);
      withEditions.editions = await enrichEditions(editions);
    } catch (e) {
      if (log) {
        log.warn(`Failed to fetch editions for ${event.name}, skipping.`, e);
      }
    }
  }

  const result = events as EventWithEditions[];

  return result.filter(event => event.editions != undefined);
};

export const getExportRecordForEvent = (
  event: EventWithEditions,
  outputDir: string,
  previouslyExportedEvents: { [filename: string]: EventWithEditions }
): ExportRecord => {
  const indexOfExportedEvent = Object.values(previouslyExportedEvents).findIndex(c => c.id === event.id);
  if (indexOfExportedEvent < 0) {
    const filename = uniqueFilenamePath(outputDir, event.name, 'json', Object.keys(previouslyExportedEvents));

    // This filename is now used.
    previouslyExportedEvents[filename] = event;

    return {
      filename: filename,
      status: 'CREATED',
      event
    };
  }
  const filename = Object.keys(previouslyExportedEvents)[indexOfExportedEvent];
  /*
  const previouslyExportedEvent = Object.values(previouslyExportedEvents)[indexOfExportedEvent];

  if (equals(previouslyExportedEvent, event)) {
    return { filename, status: 'UP-TO-DATE', event };
  }
  */
  return {
    filename,
    status: 'UPDATED',
    event
  };
};

type ExportsMap = {
  uri: string;
  filename: string;
};

export const getEventExports = (
  outputDir: string,
  previouslyExportedEvents: { [filename: string]: EventWithEditions },
  eventsBeingExported: EventWithEditions[]
): [ExportRecord[], ExportsMap[]] => {
  const allExports: ExportRecord[] = [];
  const updatedExportsMap: ExportsMap[] = []; // uri x filename
  for (const event of eventsBeingExported) {
    if (!event.id) {
      continue;
    }

    const exportRecord = getExportRecordForEvent(event, outputDir, previouslyExportedEvents);
    allExports.push(exportRecord);
    if (exportRecord.status === 'UPDATED') {
      updatedExportsMap.push({ uri: event.id, filename: exportRecord.filename });
    }
  }
  return [allExports, updatedExportsMap];
};

export const processEvents = async (
  outputDir: string,
  previouslyExportedEvents: { [filename: string]: EventWithEditions },
  enrichedEvents: EventWithEditions[],
  log: FileLog
): Promise<void> => {
  if (enrichedEvents.length === 0) {
    nothingExportedExit(log, 'No events to export from this hub, exiting.');
    return;
  }

  const [allExports, updatedExportsMap] = getEventExports(outputDir, previouslyExportedEvents, enrichedEvents);
  if (
    allExports.length === 0 ||
    (Object.keys(updatedExportsMap).length > 0 && !(await promptToOverwriteExports(updatedExportsMap, log)))
  ) {
    nothingExportedExit(log);
    return;
  }

  await ensureDirectoryExists(outputDir);

  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;
  tableStream.write([chalk.bold('File'), chalk.bold('Schema ID'), chalk.bold('Result')]);
  for (const { filename, status, event } of allExports) {
    if (status !== 'UP-TO-DATE') {
      writeJsonToFile(filename, event);
    }
    tableStream.write([filename, event.name || '', status]);
  }
  process.stdout.write('\n');
};

export const filterEvents = (events: Event[], from: Date | undefined, to: Date | undefined): Event[] => {
  return events.filter(event => {
    const eventStart = new Date(event.start as string);
    const eventEnd = new Date(event.end as string);

    if (from && eventEnd < from) {
      return false;
    }

    if (to && eventStart > to) {
      return false;
    }

    return true;
  });
};

export const handler = async (argv: Arguments<ExportEventBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, fromDate, toDate, logFile, id, snapshots } = argv;

  const log = logFile.open();

  const from = fromDate === undefined ? undefined : relativeDate(fromDate);
  const to = toDate === undefined ? undefined : relativeDate(toDate);

  const previouslyExportedEvents = loadJsonFromDirectory<EventWithEditions>(dir, EventWithEditions);

  const client = dynamicContentClientFactory(argv);

  let hub: Hub;
  try {
    hub = await client.hubs.get(argv.hubId);
  } catch (e) {
    log.error(`Couldn't get hub with id ${argv.hubId}, aborting.`, e);
    await log.close();
    return;
  }

  let filteredEvents: Event[];
  if (id) {
    try {
      filteredEvents = [await client.events.get(id)];
      log.appendLine(`Exporting single event ${filteredEvents[0].name}.`);
    } catch (e) {
      log.error(`Failed to get event with id ${id}, aborting.`, e);
      await log.close();
      return;
    }
  } else {
    try {
      const storedEvents = await paginator(hub.related.events.list);

      filteredEvents = filterEvents(storedEvents, from, to);

      log.appendLine(`Exporting ${filteredEvents.length} of ${storedEvents.length} events...`);
    } catch (e) {
      log.error(`Failed to list events.`, e);
      filteredEvents = [];
    }
  }

  const enrichedEvents = await enrichEvents(filteredEvents, log);

  await processEvents(dir, previouslyExportedEvents, enrichedEvents, log);

  if (snapshots) {
    await locateAndExportSnapshots(client, dir, enrichedEvents, log);
  }

  log.appendLine(`Done.`);

  await log.close();
};
