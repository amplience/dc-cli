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
import { getImportFileList, ImportFile } from '../../common/import/import-file-list';
import { getJsonByPath } from '../../common/import/json-by-path';
import { createContentTypeSchema } from './create.service';
import { updateContentTypeSchema } from './update.service';

export const command = 'import <manifest>';

export const desc = 'Import Content Type Schemas';

export interface SchemaOptions {
  validation: ValidationLevel;
}

export const builder = (yargs: Argv): void => {
  yargs.positional('manifest', {
    describe: 'Path to file referencing Content Type Schema definitions to be imported',
    type: 'string'
  });
};

function isSchemaImportFile(schemaFile: ImportFile<SchemaOptions>): schemaFile is ImportFile<SchemaOptions> {
  return Boolean(schemaFile.uri && schemaFile.options && schemaFile.options.validation);
}

export const getSchemaList = async (schemaFileList: ImportFile<SchemaOptions>[]): Promise<ContentTypeSchema[]> => {
  const schemas: ContentTypeSchema[] = [];
  for (const schemaFile of schemaFileList) {
    if (!isSchemaImportFile(schemaFile)) {
      throw Error('Manifest contains invalid syntax');
    } else {
      const schemaBody = await getJsonByPath(schemaFile.uri);
      schemas.push(new ContentTypeSchema({ body: schemaBody, validationLevel: schemaFile.options.validation }));
    }
  }
  return schemas;
};

export const storedSchemaMapper = (
  importedSchema: ContentTypeSchema,
  storedSchemaList: ContentTypeSchema[],
  validationLevel: ValidationLevel
): ContentTypeSchema => {
  let parsedSchemaBody: { id?: string } = {};
  try {
    parsedSchemaBody = JSON.parse(importedSchema.body || '');
  } catch (err) {
    throw new Error('Failed to parse schema body');
  }

  const found = storedSchemaList.find((stored: ContentTypeSchema) => stored.schemaId === parsedSchemaBody.id);

  return found ? { ...found.toJSON(), body: importedSchema.body, validationLevel } : importedSchema;
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
  const { manifest } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const schemaImportFiles = manifest ? getImportFileList<SchemaOptions>(manifest) : [];
  const schemas = await getSchemaList(schemaImportFiles);
  const storedSchemaList = await paginator(hub.related.contentTypeSchema.list);
  const schemasToProcess = schemas.map(imported =>
    storedSchemaMapper(imported, storedSchemaList, imported.validationLevel || ValidationLevel.CONTENT_TYPE)
  );

  await processSchemas(schemasToProcess, client, hub);
};
