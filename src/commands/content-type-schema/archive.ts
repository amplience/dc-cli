import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { equalsOrRegex } from '../../common/filter/filter';
import { confirmArchive } from '../../common/archive/archive-helpers';
import ArchiveOptions from '../../common/archive/archive-options';
import { getDefaultLogPath } from '../../common/log-helpers';
import { Status } from '../../common/dc-management-sdk-js/resource-status';

export const command = 'archive [id]';

export const desc = 'Archive Content Type Schemas';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('schema', 'archive', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe:
        'The ID of a schema to be archived. Note that this is different from the schema ID - which is in a URL format. If neither this or schemaId are provided, this command will archive ALL content type schemas in the hub.'
    })
    .option('schemaId', {
      type: 'string',
      describe:
        'The Schema ID of a Content Type Schema to be archived.\nA regex can be provided to select multiple schemas with similar IDs (eg /.header.\\.json/).\nA single --schemaId option may be given to archive a single content type schema.\nMultiple --schemaId options may be given to archive multiple content type schemas at the same time, or even multiple regex.'
    })
    .option('revertLog', {
      type: 'string',
      describe:
        'Path to a log file containing content unarchived in a previous run of the unarchive command.\nWhen provided, archives all schemas listed as unarchived in the log file.',
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
  const { id, logFile, force, silent, ignoreError, hubId, revertLog, schemaId } = argv;
  const client = dynamicContentClientFactory(argv);

  if (id != null && schemaId != null) {
    console.log('Please specify either a schema ID or an ID - not both.');
    return;
  }

  let schemas: ContentTypeSchema[];
  let allContent = false;
  let missingContent = false;

  if (id != null) {
    try {
      // Get the schema ID and use the other path, to avoid code duplication.
      const schemasIds = Array.isArray(id) ? id : [id];
      schemas = await Promise.all(schemasIds.map(id => client.contentTypeSchemas.get(id)));
    } catch (e) {
      console.log(`Fatal error: could not find schema with ID ${id}. Error: \n${e.toString()}`);
      return;
    }
  } else {
    try {
      const hub = await client.hubs.get(hubId);
      schemas = await paginator(hub.related.contentTypeSchema.list, { status: Status.ACTIVE });
    } catch (e) {
      console.log(
        `Fatal error: could not retrieve content type schemas to archive. Is your hub correct? Error: \n${e.toString()}`
      );
      return;
    }

    if (revertLog != null) {
      try {
        const log = await new ArchiveLog().loadFromFile(revertLog);
        const ids = log.getData('UNARCHIVE');
        schemas = schemas.filter(schema => ids.indexOf(schema.schemaId as string) !== -1);
        if (schemas.length !== ids.length) {
          missingContent = true;
        }
      } catch (e) {
        console.log(`Fatal error - could not read unarchive log. Error: \n${e.toString()}`);
        return;
      }
    } else if (schemaId != null) {
      const schemaIdArray: string[] = Array.isArray(schemaId) ? schemaId : [schemaId];
      schemas = schemas.filter(
        schema => schemaIdArray.findIndex(id => equalsOrRegex(schema.schemaId as string, id)) !== -1
      );
    } else {
      console.log('No filter, ID or log file was given, so archiving all content.');
      allContent = true;
    }
  }

  if (schemas.length === 0) {
    console.log('Nothing found to archive, aborting.');
    return;
  }

  console.log('The following content will be archived:');
  schemas.forEach(schema => {
    console.log('  ' + schema.schemaId);
  });

  if (!force) {
    const yes = await confirmArchive('archive', 'content type schema', allContent, missingContent);
    if (!yes) {
      return;
    }
  }

  const timestamp = Date.now().toString();
  const log = new ArchiveLog(`Content Type Schema Archive Log - ${timestamp}\n`);

  let successCount = 0;

  for (let i = 0; i < schemas.length; i++) {
    try {
      await schemas[i].related.archive();

      log.addAction('ARCHIVE', `${schemas[i].schemaId}\n`);
      successCount++;
    } catch (e) {
      log.addComment(`ARCHIVE FAILED: ${schemas[i].schemaId}`);
      log.addComment(e.toString());

      if (ignoreError) {
        log.warn(`Failed to archive ${schemas[i].schemaId}, continuing.`, e);
      } else {
        log.error(`Failed to archive ${schemas[i].schemaId}, aborting.`, e);
        break;
      }
    }
  }

  if (!silent && logFile) {
    await log.writeToFile(logFile.replace('<DATE>', timestamp));
  }

  console.log(`Archived ${successCount} content type schemas.`);
};

// log format:
// ARCHIVE <content type id>
