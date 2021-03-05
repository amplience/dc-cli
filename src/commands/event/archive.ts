import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { confirmArchive } from '../../common/archive/archive-helpers';
import ArchiveOptions from '../../common/archive/archive-options';
import { Edition, Event, DynamicContent } from 'dc-management-sdk-js';
import { equalsOrRegex } from '../../common/filter/filter';
import { getDefaultLogPath } from '../../common/log-helpers';
const maxAttempts = 30;

export const command = 'archive [id]';

export const desc = 'Archive Events';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('event', 'archive', platform);

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
      describe: 'Path to a log file to write to.'
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

export const getEvents = async ({
  id,
  client,
  hubId,
  name
}: {
  id?: string;
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
      const event = await client.events.get(id);
      const editions = await paginator(event.related.editions.list);

      return [
        {
          event,
          editions,
          command: 'ARCHIVE',
          unscheduleEditions: [],
          deleteEditions: [],
          archiveEditions: []
        }
      ];
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
  logFile?: string;
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

    const timestamp = Date.now().toString();
    const log = new ArchiveLog(`Events Archive Log - ${timestamp}\n`);

    let successCount = 0;

    for (let i = 0; i < events.length; i++) {
      try {
        await Promise.all(events[i].unscheduleEditions.map(edition => edition.related.unschedule()));

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

    if (!silent && logFile) {
      await log.writeToFile(logFile.replace('<DATE>', timestamp));
    }

    return console.log(`Processed ${successCount} events.`);
  } catch (e) {
    return;
  }
};

export const handler = async (argv: Arguments<ArchiveOptions & ConfigurationParameters>): Promise<void> => {
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
    id: id as string,
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
