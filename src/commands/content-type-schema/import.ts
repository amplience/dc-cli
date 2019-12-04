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
import { createContentTypeSchema } from './create.service';
import { updateContentTypeSchema } from './update.service';
import { ImportResult, loadJsonFromDirectory, UpdateStatus } from '../../services/import.service';
import { jsonResolver } from '../../common/import/json-resolver';

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
  const found = storedSchemas.find(stored => stored.schemaId === schema.schemaId);
  const mutatedSchema = found ? { ...schema, id: found.id } : schema;

  return new ContentTypeSchema(mutatedSchema);
};

export const doCreate = async (hub: Hub, schema: ContentTypeSchema): Promise<ContentTypeSchema> => {
  try {
    const createdSchemaType = await createContentTypeSchema(
      schema.body || '',
      schema.validationLevel || ValidationLevel.CONTENT_TYPE,
      hub
    );

    return createdSchemaType;
  } catch (err) {
    throw new Error(`Error registering content type schema with body: ${schema.body}\n\n${err}`);
  }
};

const equals = (a: ContentTypeSchema, b: ContentTypeSchema): boolean =>
  a.id === b.id && a.schemaId === b.schemaId && a.body === b.body;

export const doUpdate = async (
  client: DynamicContent,
  schema: ContentTypeSchema
): Promise<{ contentTypeSchema: ContentTypeSchema; updateStatus: UpdateStatus }> => {
  try {
    const retrievedSchema = await client.contentTypeSchemas.get(schema.id || '');
    if (equals(retrievedSchema, schema)) {
      return { contentTypeSchema: retrievedSchema, updateStatus: UpdateStatus.SKIPPED };
    }
    const updatedSchema = await updateContentTypeSchema(
      retrievedSchema,
      schema.body || '',
      schema.validationLevel || ValidationLevel.CONTENT_TYPE
    );

    return { contentTypeSchema: updatedSchema, updateStatus: UpdateStatus.UPDATED };
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

  tableStream.write([chalk.bold('ID'), chalk.bold('Schema ID'), chalk.bold('Result')]);
  for (const schema of schemasToProcess) {
    let schemaId = schema.id;
    let status: ImportResult;
    if (schema.id) {
      const result = await doUpdate(client, schema);
      status = result.updateStatus === UpdateStatus.SKIPPED ? 'UP-TO-DATE' : 'UPDATED';
    } else {
      const result = await doCreate(hub, schema);
      schemaId = result.id || 'UNKNOWN';
      status = 'CREATED';
    }
    tableStream.write([schemaId || '', schema.schemaId || '', status]);
  }
  process.stdout.write('\n');
};

export const resolveSchemaBody = async (schemas: ContentTypeSchema[], dir: string): Promise<ContentTypeSchema[]> => {
  for (const schema of schemas) {
    if (schema.body) {
      schema.body = await jsonResolver(schema.body, dir);
    }
  }
  return schemas;
};

export const handler = async (argv: Arguments<ImportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const schemas = Object.values(loadJsonFromDirectory<ContentTypeSchema>(dir, ContentTypeSchema));
  await resolveSchemaBody(schemas, dir);
  const storedSchemas = await paginator(hub.related.contentTypeSchema.list);
  const schemasToProcess = schemas.map(schemas => storedSchemaMapper(schemas, storedSchemas));

  await processSchemas(schemasToProcess, client, hub);
};
