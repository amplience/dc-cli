import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentType, DynamicContent, Hub } from 'dc-management-sdk-js';
import { isEqual } from 'lodash';
import { createStream } from 'table';
import chalk from 'chalk';
import { extractImportObjects } from '../../services/import.service';
import { streamTableOptions } from '../../common/table/table.consts';
import { TableStream } from '../../interfaces/table.interface';

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

  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;
  tableStream.write([chalk.bold('id'), chalk.bold('contentTypeUri'), chalk.bold('method'), chalk.bold('status')]);

  const contentTypesToProcess: ContentType[] = importedContentTypes.map(imported => {
    const found = storedContentTypes.find(stored => stored.contentTypeUri === imported.contentTypeUri);
    return found ? { ...found.toJSON(), ...imported } : imported;
  });

  for (const contentType of contentTypesToProcess) {
    const result = contentType.id ? doUpdate(client, contentType) : doCreate(hub, contentType);
    tableStream.write(await result);
  }

  process.stdout.write('\n');
};
