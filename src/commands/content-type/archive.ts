import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentType } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { equalsOrRegex } from '../../common/filter/filter';

import { confirmArchive } from '../../common/archive/archive-helpers';
import ArchiveOptions from '../../common/archive/archive-options';
import { getDefaultLogPath } from '../../common/log-helpers';
import { Status } from '../../common/dc-management-sdk-js/resource-status';

export const command = 'archive [id]';

export const desc = 'Archive Content Types';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('type', 'archive', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe:
        'The ID of a content type to be archived. If neither this or schemaId are provided, this command will archive ALL content types in the hub.'
    })
    .option('schemaId', {
      type: 'string',
      describe:
        "The Schema ID of a Content Type's Schema to be archived.\nA regex can be provided to select multiple types with similar or matching schema IDs (eg /.header.\\.json/).\nA single --schemaId option may be given to match a single content type schema.\nMultiple --schemaId options may be given to match multiple content type schemas at the same time, or even multiple regex."
    })
    .option('revertLog', {
      type: 'string',
      describe:
        'Path to a log file containing content unarchived in a previous run of the unarchive command.\nWhen provided, archives all types listed as unarchived in the log file.',
      requiresArg: false
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
    .option('ignoreError', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, archive requests that fail will not abort the process.'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.'
    });
};

export const handler = async (argv: Arguments<ArchiveOptions & ConfigurationParameters>): Promise<void> => {
  const { id, logFile, force, silent, ignoreError, revertLog } = argv;
  const { schemaId } = argv;
  const client = dynamicContentClientFactory(argv);

  if (id != null && schemaId != null) {
    console.log('Please specify either a schema ID or an ID - not both.');
    return;
  }

  let types: ContentType[];
  let allContent = false;
  let missingContent = false;

  if (id != null) {
    try {
      const typeIds = Array.isArray(id) ? id : [id];
      types = await Promise.all(typeIds.map(id => client.contentTypes.get(id)));
    } catch (e) {
      console.log(`Fatal error: could not find content type with ID ${id}. Error: \n${e.toString()}`);
      return;
    }
  } else {
    try {
      const hub = await client.hubs.get(argv.hubId);
      types = await paginator(hub.related.contentTypes.list, { status: Status.ACTIVE });
    } catch (e) {
      console.log(
        `Fatal error: could not retrieve content types to archive. Is your hub correct? Error: \n${e.toString()}`
      );
      return;
    }

    if (revertLog != null) {
      try {
        const log = await new ArchiveLog().loadFromFile(revertLog);
        const ids = log.getData('UNARCHIVE');
        types = types.filter(type => ids.indexOf(type.id as string) !== -1);
        if (types.length !== ids.length) {
          missingContent = true;
        }
      } catch (e) {
        console.log(`Fatal error - could not read unarchive log. Error: \n${e.toString()}`);
        return;
      }
    } else if (schemaId != null) {
      const schemaIdArray: string[] = Array.isArray(schemaId) ? schemaId : [schemaId];
      types = types.filter(
        type => schemaIdArray.findIndex(id => equalsOrRegex(type.contentTypeUri as string, id)) !== -1
      );
    } else {
      allContent = true;
      console.log('No filter, ID or log file was given, so archiving all content.');
    }
  }

  if (types.length === 0) {
    console.log('Nothing found to archive, aborting.');
    return;
  }

  console.log('The following content will be archived:');
  types.forEach(type => {
    const settings = type.settings;
    console.log('  ' + (settings === undefined ? 'unknown' : settings.label));
  });

  if (!force) {
    const yes = await confirmArchive('archive', 'content types', allContent, missingContent);
    if (!yes) {
      return;
    }
  }

  const timestamp = Date.now().toString();

  const log = new ArchiveLog(`Content Type Archive Log - ${timestamp}\n`);

  let successCount = 0;

  for (let i = 0; i < types.length; i++) {
    const settings = types[i].settings;
    const label = settings === undefined ? 'unknown' : settings.label;
    try {
      await types[i].related.archive();

      log.addAction('ARCHIVE', types[i].id || 'unknown');
      successCount++;
    } catch (e) {
      log.addComment(`ARCHIVE FAILED: ${types[i].id}`);
      log.addComment(e.toString());

      if (ignoreError) {
        log.warn(`Failed to archive ${label}, continuing.`, e);
      } else {
        log.error(`Failed to archive ${label}, aborting.`, e);
        break;
      }
    }
  }

  if (!silent && logFile) {
    await log.writeToFile(logFile.replace('<DATE>', timestamp));
  }

  console.log(`Archived ${successCount} content types.`);
};

// log format:
// ARCHIVE <content type id>
