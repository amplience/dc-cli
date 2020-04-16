import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { equalsOrRegex } from '../../common/filter/filter';
import readline, { ReadLine } from 'readline';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { exists, mkdir, writeFile } from 'fs';

export const command = 'archive [id]';

export const desc = 'Archive Content Type Schemas';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  join(
    process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname,
    '.amplience',
    'logs/schema-archive-<DATE>.log'
  );

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

export interface ArchiveOptions {
  id?: string;
  logFile: string;
  force?: boolean;
  schemaId?: string | string[];
  ignoreError?: boolean;
}

function asyncQuestion(rl: ReadLine, question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

export const handler = async (argv: Arguments<ArchiveOptions & ConfigurationParameters>): Promise<void> => {
  const { id, logFile, force, silent, ignoreError } = argv;
  let { schemaId } = argv;
  const client = dynamicContentClientFactory(argv);

  if (id != null && schemaId != null) {
    console.log('Please specify either a schema ID or an ID - not both.');
    return;
  }

  if (id != null) {
    try {
      // Get the schema ID and use the other path, to avoid code duplication.
      const contentTypeSchema: ContentTypeSchema = await client.contentTypeSchemas.get(id);
      schemaId = contentTypeSchema.schemaId;
    } catch (e) {
      console.log(`Fatal error: could not find schema with ID ${id}. Error: \n${e.toString()}`);
      return;
    }
  }

  let schemas: ContentTypeSchema[];
  try {
    const hub = await client.hubs.get(argv.hubId);
    schemas = await paginator(hub.related.contentTypeSchema.list);
  } catch (e) {
    console.log(
      `Fatal error: could not retrieve content type schemas to archive. Is your hub correct? Error: \n${e.toString()}`
    );
    return;
  }

  if (schemaId != null) {
    const schemaIdArray: string[] = schemaId ? (Array.isArray(schemaId) ? schemaId : [schemaId]) : [];
    schemas = schemas.filter(schema => schemaIdArray.findIndex(id => equalsOrRegex(schema.schemaId || '', id)) != -1);
  }

  console.log('The following content will be archived:');
  schemas.forEach(schema => {
    console.log('  ' + schema.schemaId);
  });

  if (!force) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    const question =
      schemaId == null
        ? 'Providing no ID or filter will archive ALL content type schemas! Are you sure you want to do this? (y/n)\n'
        : 'Are you sure you want to archive these content type schemas? (y/n)\n';

    const answer: string = await asyncQuestion(rl, question);
    rl.close();
    const yes = answer.length > 0 && answer[0].toLowerCase() == 'y';
    if (!yes) {
      return;
    }
  }

  const timestamp = Date.now().toString();

  const logFileName = logFile.replace('<DATE>', timestamp);

  let log = `// Content Type Schema Archive Log - ${timestamp}\n`;

  let successCount = 0;

  for (let i = 0; i < schemas.length; i++) {
    try {
      await schemas[i].related.archive();
      successCount++;
    } catch (e) {
      log += `// ARCHIVE FAILED: ${schemas[i].schemaId}\n`;
      if (ignoreError) {
        console.log(`Failed to unarchive ${schemas[i].schemaId}, continuing. Error: \n${e.toString()}`);
      } else {
        console.log(`Failed to unarchive ${schemas[i].schemaId}, aborting. Error: \n${e.toString()}`);
        break;
      }
    }

    log += `ARCHIVE ${schemas[i].schemaId}\n`;
  }

  if (!silent) {
    try {
      const dir = dirname(logFileName);
      if (!(await promisify(exists)(dir))) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);
      console.log(`Archive log written to "${logFileName}".`);
    } catch {
      console.log('Could not write archive log.');
    }
  }

  console.log(`Archived ${successCount} content type schemas.`);
};

// log format:
// ARCHIVE <content type id>
