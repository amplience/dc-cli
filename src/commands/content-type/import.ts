import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentRepository, ContentType, DynamicContent, Hub } from 'dc-management-sdk-js';
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

export class ContentTypeWithRepositoryAssignments extends ContentType {
  repositories?: string[];
}

export const storedContentTypeMapper = (contentType: ContentType, storedContentTypes: ContentType[]): ContentType => {
  const found = storedContentTypes.find(
    storedContentType => storedContentType.contentTypeUri === contentType.contentTypeUri
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

const equals = (a: ContentType, b: ContentType): boolean =>
  a.id === b.id && a.contentTypeUri === b.contentTypeUri && isEqual(a.settings, b.settings);

export const doUpdate = async (
  client: DynamicContent,
  contentType: ContentTypeWithRepositoryAssignments
): Promise<string[]> => {
  let retrievedContentType: ContentType;
  try {
    // Get the existing content type
    retrievedContentType = await client.contentTypes.get(contentType.id || '');
  } catch (err) {
    throw new Error(`Error unable to get content type ${contentType.id}: ${err.message}`);
  }

  // Check if an update is required
  if (equals(retrievedContentType.toJSON(), contentType)) {
    return [contentType.id || '', contentType.contentTypeUri || '', 'UPDATE', 'SKIPPED'];
  }

  let updatedContentType: ContentType;
  try {
    // Update the content-type
    updatedContentType = await retrievedContentType.related.update(contentType);
  } catch (err) {
    throw new Error(`Error updating content type ${contentType.id}: ${err.message}`);
  }

  return [updatedContentType.id || '', contentType.contentTypeUri || '', 'UPDATE', 'SUCCESS'];
};

type RepositoryName = string;
type ContentTypeId = string;

type ContentRepositoryAssignments = Map<RepositoryName, ContentTypeId[]>;

export const getContentRepositoryAssignments = async (hub: Hub): Promise<ContentRepositoryAssignments> => {
  const assignments = new Map<string, string[]>();
  const contentRepositoryList = await paginator<ContentRepository>(hub.related.contentRepositories.list, {});
  for (const contentRepository of contentRepositoryList) {
    assignments.set(
      contentRepository.name || '',
      (contentRepository.contentTypes || []).map(c => c.hubContentTypeId || '')
    );
  }
  return assignments;
};

export const processContentTypes = async (
  contentTypes: ContentTypeWithRepositoryAssignments[],
  storedContentRepositoryAssignments: ContentRepositoryAssignments,
  client: DynamicContent,
  hub: Hub
): Promise<void> => {
  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;

  tableStream.write([chalk.bold('id'), chalk.bold('contentTypeUri'), chalk.bold('method'), chalk.bold('status')]);
  for (const contentType of contentTypes) {
    const result = contentType.id ? await doUpdate(client, contentType) : await doCreate(hub, contentType);
    tableStream.write(result);
  }
  process.stdout.write('\n');
};

export const handler = async (argv: Arguments<ImportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;
  const importedContentTypes = loadJsonFromDirectory<ContentTypeWithRepositoryAssignments>(dir);
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedContentTypes = await paginator(hub.related.contentTypes.list);
  const contentTypesToProcess = importedContentTypes.map(imported =>
    storedContentTypeMapper(imported, storedContentTypes)
  );
  const contentRepositoryAssignments = await getContentRepositoryAssignments(hub);
  await processContentTypes(contentTypesToProcess, contentRepositoryAssignments, client, hub);
};
