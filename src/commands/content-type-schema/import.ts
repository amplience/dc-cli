import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentTypeSchema, DynamicContent, Hub, ValidationLevel } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { createStream } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { TableStream } from '../../interfaces/table.interface';
import { ImportBuilderOptions } from '../../interfaces/import-builder-options.interface';
import chalk from 'chalk';
import { isEqual } from 'lodash';
import { createContentTypeSchema } from './create.service';
import { updateContentTypeSchema } from './update.service';
import { loadJsonFromDirectory } from '../../services/import.service';

export const command = 'import <dir>';

export const desc = 'Import Content Type Schemas';

export interface SchemaOptions {
  validation: ValidationLevel;
}

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Directory containing Content Type Schema definitions',
    type: 'string'
  });
};

export const storedSchemaMapper = (
  schema: ContentTypeSchema,
  storedSchemas: ContentTypeSchema[]
): ContentTypeSchema => {
  const found = storedSchemas.find((stored: ContentTypeSchema) => stored.schemaId === schema.schemaId);
  const mutatedSchema = found ? { ...schema, id: found.id } : schema;

  return new ContentTypeSchema(mutatedSchema);
};

export const doCreate = async (hub: Hub, schema: ContentTypeSchema): Promise<string[]> => {
  try {
    const createdSchemaType = await createContentTypeSchema(
      schema.body || '',
      schema.validationLevel || ValidationLevel.CONTENT_TYPE,
      hub
    );
    return [createdSchemaType.id || '', createdSchemaType.schemaId || '', 'CREATE', 'SUCCESS'];
  } catch (err) {
    throw new Error(`Error registering content type schema with body: ${schema.body}\n\n${err.message}`);
  }
};

export const doUpdate = async (client: DynamicContent, schema: ContentTypeSchema): Promise<string[]> => {
  try {
    const retrievedSchema = await client.contentTypeSchemas.get(schema.id || '');
    if (isEqual(retrievedSchema.toJSON(), schema)) {
      return [schema.id || '', schema.schemaId || '', 'UPDATE', 'SKIPPED'];
    }
    const updatedSchema = await updateContentTypeSchema(
      retrievedSchema,
      schema.body || '',
      schema.validationLevel || ValidationLevel.CONTENT_TYPE
    );

    return [updatedSchema.id || '', schema.schemaId || '', 'UPDATE', 'SUCCESS'];
  } catch (err) {
    throw new Error(`Error updating content type schema ${schema.schemaId || '<unknown>'}: ${err.message}`);
  }
};

export const processSchemas = async (
  schemasToProcess: ContentTypeSchema[],
  client: DynamicContent,
  hub: Hub
): Promise<void> => {
  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;

  tableStream.write([chalk.bold('id'), chalk.bold('schemaId'), chalk.bold('method'), chalk.bold('status')]);
  for (const schema of schemasToProcess) {
    const result = schema.id ? doUpdate(client, schema) : doCreate(hub, schema);
    tableStream.write(await result);
  }
  process.stdout.write('\n');
};

export const handler = async (argv: Arguments<ImportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const schemas = loadJsonFromDirectory<ContentTypeSchema>(dir);
  const storedSchemas = await paginator(hub.related.contentTypeSchema.list);
  const schemasToProcess = schemas.map(schemas => storedSchemaMapper(schemas, storedSchemas));

  await processSchemas(schemasToProcess, client, hub);
};
