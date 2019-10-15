import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import * as fs from 'fs';
import path from 'path';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentType, DynamicContent, Hub } from 'dc-management-sdk-js';
import { differenceWith, intersectionWith, isEqual } from 'lodash';
import { createStream } from 'table';
import chalk from 'chalk';

export const command = 'import [dir]';

export const desc = 'Import Content Types';

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Path to Content Type definitions',
    type: 'string',
    demandOption: true
  });
};

export interface ImportBuilderOptions {
  dir: string;
}

export const extractImportObjects = <T>(dir: string): T[] => {
  const files = fs.readdirSync(dir);
  return files.map(fileName => {
    const file = fs.readFileSync(path.join(dir, fileName), 'utf-8');
    try {
      return JSON.parse(file);
    } catch (e) {
      throw new Error(`Non-JSON file found: ${fileName}, aborting import`);
    }
  });
};

interface TableStream {
  write: (row: string[]) => void;
}

export const createTableStream = (): TableStream => {
  return (createStream({
    columnDefault: {
      width: 50
    },
    columnCount: 4,
    columns: {
      0: {
        width: 36
      },
      2: {
        width: 10
      },
      3: {
        width: 10
      }
    }
  }) as unknown) as TableStream;
};

const doCreate = async (hub: Hub, contentType: ContentType): Promise<string[]> => {
  try {
    const createdContentType = await hub.related.contentTypes.register(new ContentType(contentType));
    return [createdContentType.id || '', contentType.contentTypeUri || '', 'CREATE', 'SUCCESS'];
  } catch (err) {
    throw new Error(`Error registering content type ${contentType.contentTypeUri}: ${err.message}`);
  }
};

const doUpdate = async (client: DynamicContent, contentType: ContentType): Promise<string[]> => {
  try {
    const retrievedContentType = await client.contentTypes.get(contentType.id || '');
    if (isEqual(retrievedContentType.toJSON(), contentType)) {
      return [contentType.id || '', contentType.contentTypeUri || '', 'UPDATE', 'SKIPPED'];
    }
    const updatedContentType = await retrievedContentType.related.update(contentType);
    return [updatedContentType.id || '', contentType.contentTypeUri || '', 'UPDATE', 'SUCCESS'];
  } catch (err) {
    throw new Error(`Error updating content type ${contentType.contentTypeUri || '<unknown>'}: ${err.message}`);
  }
};

export const handler = async (argv: Arguments<ImportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;
  const importedContentTypes = extractImportObjects<ContentType>(dir);
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedContentTypes = await paginator(hub.related.contentTypes.list);

  const tableStream = createTableStream();
  tableStream.write([chalk.bold('id'), chalk.bold('contentTypeUri'), chalk.bold('method'), chalk.bold('status')]);

  const compareContentType = (imported: ContentType, stored: ContentType): boolean =>
    stored.contentTypeUri === imported.contentTypeUri;

  for (const contentType of differenceWith(importedContentTypes, storedContentTypes, compareContentType)) {
    tableStream.write(await doCreate(hub, contentType));
  }
  for (const contentType of intersectionWith(importedContentTypes, storedContentTypes, compareContentType)) {
    tableStream.write(await doUpdate(client, contentType));
  }

  // const contentTypesToProcess: ContentType[] = importedContentTypes.map(imported => {
  //   const found = storedContentTypes.find(stored => stored.contentTypeUri === imported.contentTypeUri);
  //   return found || imported;
  // });
  //
  // for (const contentType of contentTypesToProcess) {
  //   if (contentType.id) {
  //     tableStream.write(await doUpdate(client, contentType));
  //   } else {
  //     tableStream.write(await doCreate(hub, contentType));
  //   }
  // }

  process.stdout.write('\n');
};
