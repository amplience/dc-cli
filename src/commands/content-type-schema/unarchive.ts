import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import { equalsOrRegex } from '../../common/filter/filter';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { confirmArchive } from '../../common/archive/archive-helpers';
import UnarchiveOptions from '../../common/archive/unarchive-options';
import { getDefaultLogPath } from '../../common/log-helpers';
import { Status } from '../../common/dc-management-sdk-js/resource-status';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('schema', 'unarchive', platform);

export const command = 'unarchive [id]';

export const desc = 'Unarchive Content Type Schemas';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe:
        'The ID of a schema to be unarchived. Note that this is different from the schema ID - which is in a URL format.'
    })
    .option('schemaId', {
      type: 'string',
      describe:
        'The Schema ID of a Content Type Schema to be unarchived.\nA regex can be provided to \nA single --schemaId option may be given to unarchive a single content type schema.\nMultiple --schemaId options may be given to unarchive multiple content type schemas at the same time.',
      requiresArg: true
    })
    .option('revertLog', {
      type: 'string',
      describe:
        'Path to a log file containing content archived in a previous run of the archive command.\nWhen provided, unarchives all schemas listed as archived in the log file.',
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
  const { id, schemaId, revertLog, ignoreError, logFile, silent, force } = argv;
  const client = dynamicContentClientFactory(argv);

  if (id != null && schemaId != null) {
    console.log('Please specify either a schema ID or an ID - not both.');
    return;
  }

  let schemas: ContentTypeSchema[] = [];
  let allContent = false;
  let missingContent = false;

  if (id != null) {
    try {
      const contentTypeSchema: ContentTypeSchema = await client.contentTypeSchemas.get(id);
      schemas = [contentTypeSchema];
    } catch (e) {
      console.log(`Fatal error: could not find content type schema with ID ${id}. Error: \n${e.toString()}`);
      return;
    }
  } else {
    try {
      const hub = await client.hubs.get(argv.hubId);
      schemas = await paginator(hub.related.contentTypeSchema.list, { status: Status.ARCHIVED });
    } catch (e) {
      console.log(
        `Fatal error: could not retrieve content type schemas to unarchive. Is your hub correct? Error: \n${e.toString()}`
      );
      return;
    }

    if (revertLog != null) {
      try {
        const log = await new ArchiveLog().loadFromFile(revertLog);
        const ids = log.getData('ARCHIVE');
        schemas = schemas.filter(schema => ids.indexOf(schema.schemaId as string) !== -1);
        if (schemas.length !== ids.length) {
          missingContent = true;
        }
      } catch (e) {
        console.log(`Fatal error - could not read archive log. Error: \n${e.toString()}`);
        return;
      }
    } else if (schemaId != null) {
      const schemaIds: string[] = Array.isArray(schemaId) ? schemaId : [schemaId];
      schemas = schemas.filter(
        schema => schemaIds.findIndex(id => equalsOrRegex(schema.schemaId as string, id)) !== -1
      );
    } else {
      allContent = true;
      console.log('No filter, ID or log file was given, so unarchiving all content.');
    }
  }

  if (schemas.length === 0) {
    console.log('Nothing found to unarchive, aborting.');
    return;
  }

  console.log('The following content will be unarchived:');
  schemas.forEach(schema => {
    console.log('  ' + schema.schemaId);
  });

  if (!force) {
    const yes = await confirmArchive('unarchive', 'content type schema', allContent, missingContent);
    if (!yes) {
      return;
    }
  }

  const timestamp = Date.now().toString();
  const log = new ArchiveLog(`Content Type Schema Unarchive Log - ${timestamp}\n`);

  let successCount = 0;

  for (let i = 0; i < schemas.length; i++) {
    try {
      await schemas[i].related.unarchive();

      log.addAction('UNARCHIVE', schemas[i].schemaId as string);
      successCount++;
    } catch (e) {
      log.addComment(`UNARCHIVE FAILED: ${schemas[i].schemaId}`);
      log.addComment(e.toString());

      if (ignoreError) {
        log.warn(`Failed to unarchive ${schemas[i].schemaId}, continuing.`, e);
      } else {
        log.error(`Failed to unarchive ${schemas[i].schemaId}, aborting.`, e);
        break;
      }
    }
    console.log('Unarchived: ' + schemas[i].schemaId);
  }

  if (!silent && logFile) {
    await log.writeToFile(logFile.replace('<DATE>', timestamp));
  }

  console.log(`Unarchived ${successCount} content type schemas.`);
};
