import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { confirmArchive } from '../../common/archive/archive-helpers';
import ArchiveEventOptions from '../../common/archive/archive-event-options';
import { Edition, Event, DynamicContent } from 'dc-management-sdk-js';
import { equalsOrRegex } from '../../common/filter/filter';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
import { relativeDate } from '../../common/filter/facet';
const maxAttempts = 30;

export const command = 'archive [id]';

export const desc = 'Archive Events';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('event', 'archive', platform);

export const coerceLog = (logFile: string): FileLog => createLog(logFile, 'Events Archive Log');

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe:
        'The ID of an Event to be archived. If id is not provided, this command will not archive something. Ignores other filters, and archives regardless of whether the event is active or not.'
    })
    .option('name', {
      type: 'string',
      describe:
        'The name of an Event to be archived.\nA regex can be provided to select multiple items with similar or matching names (eg /.header/).\nA single --name option may be given to match a single event pattern.\nMultiple --name options may be given to match multiple events patterns at the same time, or even multiple regex.'
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, there will be no confirmation prompt before archiving the found content.'
    })
    .alias('s', 'silent')
    .option('s', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, no log file will be produced.'
    })
    .option('editions', {
      type: 'boolean',
      boolean: true,
      describe: 'Only archive and delete editions, not events.'
    })
    .option('onlyInactive', {
      type: 'boolean',
      boolean: true,
      describe: 'Only archive and delete inactive editons and events.'
    })
    .option('fromDate', {
      describe: 'Start date for filtering events. Either "NOW" or in the format "<number>:<unit>", example: "-7:DAYS".',
      type: 'string'
    })
    .option('toDate', {
      describe: 'To date for filtering events. Either "NOW" or in the format "<number>:<unit>", example: "-7:DAYS".',
      type: 'string'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: coerceLog
    });
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

export const filterEditions = (editions: Edition[], from: Date | undefined, to: Date | undefined): Edition[] => {
  return editions.filter(edition => {
    const editionStart = new Date(edition.start as string);
    const editionEnd = new Date(edition.end as string);

    if (from && editionEnd < from) {
      return false;
    }

    if (to && editionStart > to) {
      return false;
    }

    return true;
  });
};

const getEventUntilSuccess = async ({
  id = '',
  resource = 'archive',
  client
}: {
  id: string;
  resource: string;
  client: DynamicContent;
}): Promise<Event | undefined> => {
  let resourceEvent;

  for (let i = 0; i < maxAttempts; i++) {
    const event: Event = await client.events.get(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = event._links && (event._links as any)[resource];
    if (link) {
      resourceEvent = event;
      break;
    }
  }

  return resourceEvent;
};

type EventEntry = {
  event: Event;
  editions: Edition[];
  archiveEditions: Edition[];
  deleteEditions: Edition[];
  unscheduleEditions: Edition[];
  command: string;
};

export const preprocessEvents = (entries: EventEntry[], editions?: boolean, onlyInactive?: boolean): EventEntry[] => {
  if (onlyInactive) {
    const now = new Date();

    entries = entries.filter(entry => {
      if (editions) {
        // Archive editions if the current date doesn't fall within the edition date.
        entry.editions = entry.editions.filter(edition => {
          const start = new Date(edition.start as string);
          const end = new Date(edition.end as string);

          return now < start || now > end;
        });

        return entry.editions.length != 0;
      } else {
        // Only archive an event if the current date doesn't fall within the event date.
        const start = new Date(entry.event.start as string);
        const end = new Date(entry.event.end as string);

        return now < start || now > end;
      }
    });
  }

  if (editions) {
    entries = entries.filter(entry => entry.editions.length != 0);
  }

  return entries;
};

export const getEvents = async ({
  id,
  client,
  hubId,
  name,
  from,
  to,
  editions,
  onlyInactive
}: {
  id?: string | string[];
  hubId: string;
  name?: string | string[];
  from?: Date;
  to?: Date;
  editions?: boolean;
  onlyInactive?: boolean;
  client: DynamicContent;
}): Promise<EventEntry[]> => {
  try {
    if (id != null) {
      const ids = Array.isArray(id) ? id : [id];

      const result = await Promise.all(
        ids.map(async id => {
          const event = await client.events.get(id);
          let foundEditions = await paginator(event.related.editions.list);

          if (editions) {
            foundEditions = filterEditions(foundEditions, from, to);
          }

          return {
            event,
            editions: foundEditions,
            command: 'ARCHIVE',
            unscheduleEditions: [],
            deleteEditions: [],
            archiveEditions: []
          };
        })
      );

      return preprocessEvents(result, editions, onlyInactive);
    }

    const hub = await client.hubs.get(hubId);
    const eventsList = filterEvents(await paginator(hub.related.events.list), from, to);
    let events: Event[] = eventsList;

    if (name != null) {
      const itemsArray: string[] = Array.isArray(name) ? name : [name];
      events = eventsList.filter(
        ({ name: eventName }) =>
          itemsArray.findIndex(id => {
            return equalsOrRegex(eventName || '', id);
          }) != -1
      );
    }

    const result = await Promise.all(
      events.map(async event => {
        let foundEditions = await paginator(event.related.editions.list);

        if (editions) {
          foundEditions = filterEditions(foundEditions, from, to);
        }

        return {
          event,
          editions: foundEditions,
          command: 'ARCHIVE',
          unscheduleEditions: [],
          deleteEditions: [],
          archiveEditions: []
        };
      })
    );

    return preprocessEvents(result, editions, onlyInactive);
  } catch (e) {
    console.log(e);
    return [];
  }
};

export const processItems = async ({
  client,
  events,
  force,
  silent,
  missingContent,
  logFile,
  editions
}: {
  client: DynamicContent;
  events: {
    event: Event;
    editions: Edition[];
    archiveEditions: Edition[];
    deleteEditions: Edition[];
    unscheduleEditions: Edition[];
    command: string;
  }[];
  force?: boolean;
  silent?: boolean;
  logFile: FileLog;
  missingContent: boolean;
  ignoreError?: boolean;
  editions?: boolean;
}): Promise<void> => {
  try {
    for (let i = 0; i < events.length; i++) {
      events[i].deleteEditions = events[i].editions.filter(
        ({ publishingStatus }) => publishingStatus === 'DRAFT' || publishingStatus === 'UNSCHEDULING'
      );
      events[i].unscheduleEditions = events[i].editions.filter(
        ({ publishingStatus }) => publishingStatus === 'SCHEDULED' || publishingStatus === 'SCHEDULING'
      );
      events[i].archiveEditions = events[i].editions.filter(
        ({ publishingStatus }) => publishingStatus === 'PUBLISHED' || publishingStatus === 'PUBLISHING'
      );

      if (events[i].deleteEditions.length + events[i].unscheduleEditions.length === events[i].editions.length) {
        events[i].command = 'DELETE';
      }
    }

    console.log('The following events are processing:');
    events.forEach(({ event, command = '', deleteEditions, unscheduleEditions, archiveEditions }) => {
      const hasEditions = deleteEditions.length || unscheduleEditions.length;

      if (!editions) {
        console.log(`${command}: ${event.name} (${event.id})`);
      } else if (hasEditions) {
        console.log(`${event.name} (${event.id})`);
      }

      if (hasEditions) {
        console.log(' Editions:');
        deleteEditions.forEach(({ name, id }) => {
          console.log(`   DELETE: ${name} (${id})`);
        });
        archiveEditions.forEach(({ name, id }) => {
          console.log(`   ARCHIVE: ${name} (${id})`);
        });
        unscheduleEditions.forEach(({ name, id }) => {
          console.log(`   UNSCHEDULE: ${name} (${id})`);
        });
      }
    });
    console.log(`Total: ${events.length}`);

    if (!force) {
      const yes = await confirmArchive('perform', 'actions', false, missingContent);
      if (!yes) {
        return;
      }
    }

    const log = logFile.open();

    let successCount = 0;
    let editionSuccessCount = 0;

    for (let i = 0; i < events.length; i++) {
      try {
        await Promise.all(events[i].unscheduleEditions.map(edition => edition.related.unschedule()));

        if (events[i].command === 'ARCHIVE' || editions) {
          await Promise.all(
            events[i].deleteEditions.map(edition => edition.related.delete().then(() => editionSuccessCount++))
          );

          await Promise.all(
            events[i].archiveEditions.map(edition => edition.related.archive().then(() => editionSuccessCount++))
          );
        }

        if (!editions) {
          const resource = await getEventUntilSuccess({
            id: events[i].event.id || '',
            resource: events[i].command.toLowerCase(),
            client
          });

          if (!resource) {
            log.addComment(`${events[i].command} FAILED: ${events[i].event.id}`);
            log.addComment(`You don't have access to perform this action, try again later or contact support.`);
          }

          if (events[i].command === 'DELETE') {
            resource && (await resource.related.delete());
            log.addAction(events[i].command, `${events[i].event.id}\n`);
            successCount++;
          } else {
            resource && (await resource.related.archive());
            log.addAction(events[i].command, `${events[i].event.id}\n`);
            successCount++;
          }
        }
      } catch (e) {
        console.log(e);
        log.addComment(`${events[i].command} FAILED: ${events[i].event.id}`);
        log.addComment(e.toString());
      }
    }

    await log.close(!silent);

    return console.log(`Processed ${successCount} events, ${editionSuccessCount} editions.`);
  } catch (e) {
    return;
  }
};

export const handler = async (argv: Arguments<ArchiveEventOptions & ConfigurationParameters>): Promise<void> => {
  const { id, logFile, force, silent, name, hubId, fromDate, toDate, editions, onlyInactive } = argv;
  const client = dynamicContentClientFactory(argv);

  const from = fromDate === undefined ? undefined : relativeDate(fromDate);
  const to = toDate === undefined ? undefined : relativeDate(toDate);

  const missingContent = false;

  if (name && id) {
    console.log('ID of event is specified, ignoring name');
  }

  if (!name && !id && !from && !to) {
    console.log('No date range, ID or name is specified');
    return;
  }

  const events = await getEvents({
    id,
    client,
    hubId,
    name,
    from,
    to,
    editions,
    onlyInactive
  });

  if (events.length == 0) {
    console.log('Nothing found to archive, aborting.');
    return;
  }

  await processItems({
    client,
    events,
    missingContent,
    logFile,
    force,
    silent,
    editions
  });
};

// log format:
// ARCHIVE <event id>
// DELETE <event id>
