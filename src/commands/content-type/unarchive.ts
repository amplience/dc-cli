import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentType } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import { equalsOrRegex } from '../../common/filter/filter';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { confirmArchive } from '../../common/archive/archive-helpers';
import UnarchiveOptions from '../../common/archive/unarchive-options';
import { getDefaultLogPath } from '../../common/log-helpers';
import { Status } from '../../common/dc-management-sdk-js/resource-status';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('type', 'unarchive', platform);

export const command = 'unarchive [id]';

export const desc = 'Unarchive Content Types';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe: 'The ID of a content type to be unarchived.'
    })
    .option('schemaId', {
      type: 'string',
      describe:
        "The Schema ID of a Content Type's Schema to be unarchived.\nA regex can be provided to select multiple types with similar or matching schema IDs (eg /.header.\\.json/).\nA single --schemaId option may be given to match a single content type schema.\nMultiple --schemaId options may be given to match multiple content type schemas at the same time, or even multiple regex.",
      requiresArg: true
    })
    .option('revertLog', {
      type: 'string',
      describe:
        'Path to a log file containing content archived in a previous run of the archive command.\nWhen provided, unarchives all content types listed as archived in the log file.',
      requiresArg: false
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, there will be no confirmation prompt before unarchiving the found content.'
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
      describe: 'If present, unarchive requests that fail will not abort the process.'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.'
    });
};

export const handler = async (argv: Arguments<UnarchiveOptions & ConfigurationParameters>): Promise<void> => {
  const { id, schemaId, revertLog, ignoreError, logFile, silent, hubId, force } = argv;
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
      const contentType: ContentType = await client.contentTypes.get(id);
      types = [contentType];
    } catch (e) {
      console.log(`Fatal error: could not find content type with ID ${id}. Error: \n${e.toString()}`);
      return;
    }
  } else {
    try {
      const hub = await client.hubs.get(hubId);
      types = await paginator(hub.related.contentTypes.list, { status: Status.ARCHIVED });
    } catch (e) {
      console.log(
        `Fatal error: could not retrieve content types to unarchive. Is your hub correct? Error: \n${e.toString()}`
      );
      return;
    }

    if (revertLog != null) {
      try {
        const log = await new ArchiveLog().loadFromFile(revertLog);
        const ids = log.getData('ARCHIVE');
        types = types.filter(type => ids.indexOf(type.id || '') !== -1);
        if (types.length !== ids.length) {
          missingContent = true;
        }
      } catch (e) {
        console.log(`Fatal error - could not read archive log. Error: \n${e.toString()}`);
        return;
      }
    } else if (schemaId != null) {
      const schemaIds: string[] = Array.isArray(schemaId) ? schemaId : [schemaId];
      types = types.filter(
        schema => schemaIds.findIndex(id => equalsOrRegex(schema.contentTypeUri as string, id)) !== -1
      );
    } else {
      allContent = true;
      console.log('No filter, ID or log file was given, so unarchiving all content.');
    }
  }

  if (types.length === 0) {
    console.log('Nothing found to unarchive, aborting.');
    return;
  }

  console.log('The following content will be unarchived:');
  types.forEach(type => {
    const settings = type.settings;
    console.log('  ' + (typeof settings === 'undefined' ? 'unknown' : settings.label));
  });

  if (!force) {
    const yes = await confirmArchive('unarchive', 'content types', allContent, missingContent);
    if (!yes) {
      return;
    }
  }

  const timestamp = Date.now().toString();
  const log = new ArchiveLog(`Content Type Unarchive Log - ${timestamp}\n`);

  let successCount = 0;

  for (let i = 0; i < types.length; i++) {
    const settings = types[i].settings;
    const label = settings === undefined ? 'unknown' : settings.label;
    try {
      await types[i].related.unarchive();

      log.addAction('UNARCHIVE', types[i].id || 'unknown');
      successCount++;
    } catch (e) {
      log.addComment(`UNARCHIVE FAILED: ${types[i].id}`);
      log.addComment(e.toString());

      if (ignoreError) {
        log.warn(`Failed to unarchive ${label}, continuing.`, e);
      } else {
        log.error(`Failed to unarchive ${label}, aborting.`, e);
        break;
      }
    }
    console.log('Unarchived: ' + label);
  }

  if (!silent && logFile) {
    await log.writeToFile(logFile.replace('<DATE>', timestamp));
  }

  console.log(`Unarchived ${successCount} content types.`);
};
