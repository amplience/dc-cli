import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { confirmArchive } from '../../common/archive/archive-helpers';
import ArchiveEventOptions from '../../common/archive/archive-event-options';
import { Edition, Event, DynamicContent, HalResource } from 'dc-management-sdk-js';
import { equalsOrRegex } from '../../common/filter/filter';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
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
      describe: 'The ID of an Event to be archived. If id is not provided, this command will not archive something.'
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
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: coerceLog
    });
};

const getResourceUntilSuccess = async ({
  id = '',
  resource = 'archive',
  getter
}: {
  id: string;
  resource: string;
  getter: (id: string) => Promise<HalResource>;
}): Promise<HalResource | undefined> => {
  let resourceEvent;

  for (let i = 0; i < maxAttempts; i++) {
    const obj: HalResource = await getter(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = obj._links && (obj._links as any)[resource];
    if (link) {
      resourceEvent = obj;
      break;
    }
  }

  return resourceEvent;
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
  return (await getResourceUntilSuccess({ id, resource, getter: client.events.get })) as (Event | undefined);
};

const getEditionUntilSuccess = async ({
  id = '',
  resource = 'archive',
  client
}: {
  id: string;
  resource: string;
  client: DynamicContent;
}): Promise<Edition | undefined> => {
  return (await getResourceUntilSuccess({ id, resource, getter: client.editions.get })) as (Edition | undefined);
};

export const getEvents = async ({
  id,
  client,
  hubId,
  name
}: {
  id?: string | string[];
  hubId: string;
  name?: string | string[];
  client: DynamicContent;
}): Promise<
  {
    event: Event;
    editions: Edition[];
    archiveEditions: Edition[];
    deleteEditions: Edition[];
    unscheduleEditions: Edition[];
    command: string;
  }[]
> => {
  try {
    if (id != null) {
      const ids = Array.isArray(id) ? id : [id];

      return await Promise.all(
        ids.map(async id => {
          const event = await client.events.get(id);
          const editions = await paginator(event.related.editions.list);

          return {
            event,
            editions,
            command: 'ARCHIVE',
            unscheduleEditions: [],
            deleteEditions: [],
            archiveEditions: []
          };
        })
      );
    }

    const hub = await client.hubs.get(hubId);
    const eventsList = await paginator(hub.related.events.list);
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

    return await Promise.all(
      events.map(async event => ({
        event,
        editions: await paginator(event.related.editions.list),
        command: 'ARCHIVE',
        unscheduleEditions: [],
        deleteEditions: [],
        archiveEditions: []
      }))
    );
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
  logFile
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
      console.log(`${command}: ${event.name} (${event.id})`);
      if (deleteEditions.length || unscheduleEditions.length) {
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

    for (let i = 0; i < events.length; i++) {
      try {
        const index = i;

        await Promise.all(
          events[i].unscheduleEditions.map(async edition => {
            await edition.related.unschedule();

            if (events[index].command === 'ARCHIVE') {
              // Unscheduled editions need to be deleted before the event can be archived.
              const unscheduled = await getEditionUntilSuccess({
                id: edition.id as string,
                resource: 'delete',
                client
              });

              if (unscheduled) {
                await unscheduled.related.delete();
              } else {
                log.addComment(`UNSCHEDULE+DELETE FAILED: ${edition.id}`);
                log.addComment(
                  `The edition may have taken too long to unschedule. Try again later or contact support.`
                );
              }
            }
          })
        );

        if (events[i].command === 'ARCHIVE') {
          await Promise.all(events[i].deleteEditions.map(edition => edition.related.delete()));

          await Promise.all(events[i].archiveEditions.map(edition => edition.related.archive()));
        }

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
      } catch (e) {
        console.log(e);
        log.addComment(`${events[i].command} FAILED: ${events[i].event.id}`);
        log.addComment(e.toString());
      }
    }

    await log.close(!silent);

    return console.log(`Processed ${successCount} events.`);
  } catch (e) {
    return;
  }
};

export const handler = async (argv: Arguments<ArchiveEventOptions & ConfigurationParameters>): Promise<void> => {
  const { id, logFile, force, silent, name, hubId } = argv;
  const client = dynamicContentClientFactory(argv);

  const missingContent = false;

  if (name && id) {
    console.log('ID of event is specified, ignoring name');
  }

  if (!name && !id) {
    console.log('No ID or name is specified');
    return;
  }

  const events = await getEvents({
    id,
    client,
    hubId,
    name
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
    silent
  });
};

// log format:
// ARCHIVE <event id>
// DELETE <event id>
