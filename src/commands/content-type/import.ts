import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentType, DynamicContent, Hub } from 'dc-management-sdk-js';
import { isEqual } from 'lodash';
import { createStream } from 'table';
import chalk from 'chalk';
import { loadJsonFromDirectory } from '../../services/import.service';
import { streamTableOptions } from '../../common/table/table.consts';
import { TableStream } from '../../interfaces/table.interface';
import { ImportBuilderOptions } from '../../interfaces/import-builder-options.interface';

export const command = 'import <dir>';

export const desc = 'Import Content Types';

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Path to Content Type definitions',
    type: 'string'
  });
};

export const storedContentTypeMapper = (contentType: ContentType, storedContentTypes: ContentType[]): ContentType => {
  const found = storedContentTypes.find(
    storedContentTypes => storedContentTypes.contentTypeUri === contentType.contentTypeUri
  );
  const mutatedContentType = found ? { ...contentType, id: found.id } : contentType;

  return new ContentType(mutatedContentType);
};

export const doCreate = async (hub: Hub, contentType: ContentType): Promise<string[]> => {
  try {
    const createdContentType = await hub.related.contentTypes.register(new ContentType(contentType));
    return [createdContentType.id || '', contentType.contentTypeUri || '', 'CREATE', 'SUCCESS'];
  } catch (err) {
    throw new Error(`Error registering content type ${contentType.contentTypeUri}: ${err.message}`);
  }
};

export const doUpdate = async (client: DynamicContent, contentType: ContentType): Promise<string[]> => {
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

export const processContentTypes = async (
  contentTypes: ContentType[],
  client: DynamicContent,
  hub: Hub
): Promise<void> => {
  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;

  tableStream.write([chalk.bold('id'), chalk.bold('contentTypeUri'), chalk.bold('method'), chalk.bold('status')]);
  for (const contentType of contentTypes) {
    const result = contentType.id ? doUpdate(client, contentType) : doCreate(hub, contentType);
    tableStream.write(await result);
  }
  process.stdout.write('\n');
};

export const handler = async (argv: Arguments<ImportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;
  const importedContentTypes = loadJsonFromDirectory<ContentType>(dir);
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedContentTypes = await paginator(hub.related.contentTypes.list);
  const contentTypesToProcess: ContentType[] = importedContentTypes.map(imported =>
    storedContentTypeMapper(imported, storedContentTypes)
  );

  await processContentTypes(contentTypesToProcess, client, hub);
};
