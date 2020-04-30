import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import { equalsOrRegex } from '../../common/filter/filter';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { readFile } from 'fs';
import { promisify } from 'util';

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
    .option('ignoreError', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, unarchive requests that fail will not abort the process.'
    });
};

export interface UnarchiveOptions {
  id?: string;
  schemaId?: string | string[];
  revertLog?: string;
  ignoreError?: boolean;
}

export const handler = async (argv: Arguments<UnarchiveOptions & ConfigurationParameters>): Promise<void> => {
  const { id, schemaId, revertLog, ignoreError } = argv;
  const client = dynamicContentClientFactory(argv);

  if (id != null && schemaId != null) {
    console.log('Please specify either a schema ID or an ID - not both.');
    return;
  }

  let schemaIds: string[] = [];

  if (revertLog != null) {
    try {
      const log = await new ArchiveLog().loadFromFile(revertLog);
      schemaIds = log.getData('ARCHIVE');
    } catch (e) {
      console.log(`Fatal error - could not read archive log. Error: \n${e.toString()}`);
      return;
    }
  } else if (schemaId != null) {
    schemaIds = schemaId ? (Array.isArray(schemaId) ? schemaId : [schemaId]) : [];
  } else if (id != null) {
    const contentTypeSchema: ContentTypeSchema = await client.contentTypeSchemas.get(id);
    schemaIds = [contentTypeSchema.schemaId || ''];
  }

  let schemas: ContentTypeSchema[];
  try {
    const hub = await client.hubs.get(argv.hubId);
    schemas = await paginator(hub.related.contentTypeSchema.list);
  } catch (e) {
    console.log(
      `Fatal error: could not retrieve content type schemas to unarchive. Is your hub correct? Error: \n${e.toString()}`
    );
    return;
  }

  if (schemaIds.length > 0) {
    schemas = schemas.filter(schema => schemaIds.findIndex(id => equalsOrRegex(schema.schemaId || '', id)) != -1);
  } else {
    console.log('No filter, ID or log file was given, so unarchiving all content.');
  }

  let successCount = 0;

  for (let i = 0; i < schemas.length; i++) {
    try {
      await schemas[i].related.unarchive();
      successCount++;
    } catch (e) {
      if (ignoreError) {
        console.log(`Failed to unarchive ${schemas[i].schemaId}, continuing. Error: \n${e.toString()}`);
      } else {
        console.log(`Failed to unarchive ${schemas[i].schemaId}, aborting. Error: \n${e.toString()}`);
        return;
      }
    }
    console.log('Unarchived: ' + schemas[i].schemaId);
  }

  console.log(`Unarchived ${successCount} content type schemas.`);
};
