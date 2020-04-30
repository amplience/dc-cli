import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentType } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ArchiveLog } from '../../common/archive/archive-log';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { equalsOrRegex } from '../../common/filter/filter';
import readline, { ReadLine } from 'readline';
import { join } from 'path';

export const command = 'archive [id]';

export const desc = 'Archive Content Types';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  join(
    process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname,
    '.amplience',
    'logs/type-archive-<DATE>.log'
  );

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
  const { schemaId } = argv;
  const client = dynamicContentClientFactory(argv);

  if (id != null && schemaId != null) {
    console.log('Please specify either a schema ID or an ID - not both.');
    return;
  }

  let types: ContentType[];

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
      const hub = await client.hubs.get(argv.hubId);
      types = await paginator(hub.related.contentTypes.list);
    } catch (e) {
      console.log(
        `Fatal error: could not retrieve content types to archive. Is your hub correct? Error: \n${e.toString()}`
      );
      return;
    }

    if (schemaId != null) {
      const schemaIdArray: string[] = schemaId ? (Array.isArray(schemaId) ? schemaId : [schemaId]) : [];
      types = types.filter(type => schemaIdArray.findIndex(id => equalsOrRegex(type.contentTypeUri || '', id)) != -1);
    }
  }

  console.log('The following content will be archived:');
  types.forEach(type => {
    const settings = type.settings;
    console.log('  ' + (settings === undefined ? 'unknown' : settings.label));
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

  const log = new ArchiveLog(`Content Type Archive Log - ${timestamp}\n`);

  // let log = `// Content Type Archive Log - ${timestamp}\n`;

  let successCount = 0;

  for (let i = 0; i < types.length; i++) {
    const settings = types[i].settings;
    const label = settings === undefined ? 'unknown' : settings.label;
    try {
      await types[i].related.archive();
      successCount++;
    } catch (e) {
      log.addComment(`ARCHIVE FAILED: ${types[i].id}`);
      if (ignoreError) {
        console.log(`Failed to unarchive ${label}, continuing. Error: \n${e.toString()}`);
      } else {
        console.log(`Failed to unarchive ${label}, aborting. Error: \n${e.toString()}`);
        break;
      }
    }

    log.addAction('ARCHIVE', types[i].id || 'unknown');
  }

  if (!silent) {
    await log.writeToFile(logFileName);
  }

  console.log(`Archived ${successCount} content types.`);
};

// log format:
// ARCHIVE <content type id>
