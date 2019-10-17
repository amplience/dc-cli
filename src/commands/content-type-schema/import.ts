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
import { listDirectory } from '../../common/directory-list';
import { getSchemaBody } from './helper/content-type-schema.helper';
import { createContentTypeSchema } from './create.service';

export const command = 'import';

export const desc = 'Import Content Type Schemas';

export const builder = (yargs: Argv): void => {
  yargs
    .options({
      dir: {
        describe: 'Path to Content Type Schema definitions',
        type: 'string'
      },
      remote: {
        describe: 'Path to file referencing remote Content Type Schema definitions',
        type: 'string'
      }
    })
    .conflicts('dir', 'remote')
    .demandCommand(1);
};

const doCreate = async (hub: Hub, schema: ContentTypeSchema): Promise<string[]> => {
  try {
    const createdSchemaType = await createContentTypeSchema(schema.body || '', ValidationLevel.CONTENT_TYPE, hub);
    return [createdSchemaType.id || '', createdSchemaType.schemaId || '', 'CREATE', 'SUCCESS'];
  } catch (err) {
    throw new Error(`Error registering content type schema ${schema.schemaId}: ${err.message}`);
  }
};

const doUpdate = async (client: DynamicContent, schema: ContentTypeSchema): Promise<string[]> => {
  try {
    const retrievedSchema = await client.contentTypeSchemas.get(schema.id || '');
    if (isEqual(retrievedSchema.toJSON(), schema)) {
      return [schema.id || '', schema.schemaId || '', 'UPDATE', 'SKIPPED'];
    }
    const updatedSchema = await retrievedSchema.related.update(schema);
    return [updatedSchema.id || '', schema.schemaId || '', 'UPDATE', 'SUCCESS'];
  } catch (err) {
    throw new Error(`Error updating content type schema ${schema.schemaId || '<unknown>'}: ${err.message}`);
  }
};

export const handler = async (argv: Arguments<ImportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;

  const schemaFileList = listDirectory(dir);
  const schemas: ContentTypeSchema[] = [];
  for (const schemaFile of schemaFileList) {
    const schemaBody = await getSchemaBody(schemaFile);
    schemas.push(new ContentTypeSchema({ body: schemaBody }));
  }

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedSchemaList = await paginator(hub.related.contentTypeSchema.list);

  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;
  tableStream.write([chalk.bold('id'), chalk.bold('schemaId'), chalk.bold('method'), chalk.bold('status')]);

  const schemasToProcess: ContentTypeSchema[] = schemas.map(importedSchema => {
    const parsedSchemaBody = JSON.parse(importedSchema.body || '');
    const found = storedSchemaList.find(stored => stored.schemaId === parsedSchemaBody.id);
    return found ? { ...found.toJSON(), body: importedSchema.body } : importedSchema;
  });

  for (const schema of schemasToProcess) {
    const result = schema.id ? doUpdate(client, schema) : doCreate(hub, schema);
    tableStream.write(await result);
  }

  process.stdout.write('\n');
};
