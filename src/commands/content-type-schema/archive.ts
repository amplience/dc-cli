import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentTypeSchema, Status } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import { equalsOrRegex } from '../../common/filter/filter';
import { confirmArchive } from '../../common/archive/archive-helpers';
import ArchiveOptions from '../../common/archive/archive-options';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';
import { paginateWithProgress } from '../../common/dc-management-sdk-js/paginate-with-progress';
import { progressBar } from '../../common/progress-bar/progress-bar';

export const command = 'archive [id]';

export const desc = 'Archive Content Type Schemas';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('schema', 'archive', platform);

export const coerceLog = (logFile: string): FileLog => createLog(logFile, 'Content Type Schema Archive Log');

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
      describe: 'Path to a log file to write to.',
      coerce: coerceLog
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
      console.log(`Fatal error: could not find schema with ID ${id}`);
      return;
    }
  } else {
    try {
      const hub = await client.hubs.get(hubId);
      schemas = await paginateWithProgress(
        hub.related.contentTypeSchema.list,
        { status: Status.ACTIVE },
        { title: 'Retrieving active content type schemas' }
      );
    } catch (e) {
      console.log(`Fatal error: could not retrieve content type schemas to archive`);
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
        console.log(`Fatal error - could not read unarchive log`);
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

  const log = logFile.open();
  const progress = progressBar(schemas.length, 0, { title: 'Archiving content type schemas' });
  let successCount = 0;

  for (let i = 0; i < schemas.length; i++) {
    try {
      await schemas[i].related.archive();

      progress.increment();
      log.addAction('ARCHIVE', `${schemas[i].schemaId}`);
      successCount++;
    } catch (e) {
      progress.increment();
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

  progress.stop();

  await log.close(!silent);

  console.log(`Archived ${successCount} content type schemas.`);
};

// log format:
// ARCHIVE <content type id>
