import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import * as fs from 'fs';
import path from 'path';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentType } from 'dc-management-sdk-js';
import { differenceWith, intersectionWith } from 'lodash';
import { createStream } from 'table';
import chalk from "chalk";


export const command = 'import [dir]';

export const desc = 'Import Content Types';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
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

export const handler = async (
  argv: Arguments<ImportBuilderOptions & ConfigurationParameters>
): Promise<void> => {
  const {dir} = argv;
  const importedContentTypes = extractImportObjects<ContentType>(dir);
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedContentTypes = await paginator(hub.related.contentTypes.list);

  const compareContentType = (imported: ContentType, stored: ContentType): boolean =>
    stored.contentTypeUri === imported.contentTypeUri;

  const contentTypesToCreate = differenceWith(importedContentTypes, storedContentTypes, compareContentType);
  const contentTypesToUpdate = intersectionWith(importedContentTypes, storedContentTypes, compareContentType);

  const resultSummary = (createStream({
    columnDefault: {
      width: 50
    },
    columnCount: 4,
    columns: {
      0: {
        width: 36,
      },
      2: {
        width: 10
      },
      3: {
        width: 10
      }
    }
  }) as unknown) as { write: (x: string[]) => void };

  resultSummary.write([ chalk.bold('id'), chalk.bold('contentTypeUri'), chalk.bold('method'), chalk.bold('status') ]);

  for (const contentType of contentTypesToCreate) {
    try {
      const createdContentType = await hub.related.contentTypes.register(new ContentType(contentType));
      resultSummary.write([createdContentType.id || '', contentType.contentTypeUri || '', 'CREATE', 'SUCCESS']);
    } catch (err) {
      throw new Error(`Error registering content type ${contentType.contentTypeUri}: ${err.message}`);
    }
  }

  for (const contentType of contentTypesToUpdate) {
    try {
      if (!contentType.id) {
        throw Error("Content type missing id.");
      }
      const retrievedContentType = await client.contentTypes.get(contentType.id);
      const updatedContentType = await retrievedContentType.related.update(contentType);
      resultSummary.write([updatedContentType.id || '', contentType.contentTypeUri || '', 'UPDATE', 'SUCCESS']);
    } catch (err) {
      throw new Error(`Error updating content type ${contentType.contentTypeUri || '<unknown>'}: ${err.message}`);
    }

    process.stdout.write("\n");
  }

};
