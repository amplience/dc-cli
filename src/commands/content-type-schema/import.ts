import { Argv, Arguments } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { extractImportObjects } from '../../services/import.service';
import { ContentTypeSchema, Hub, DynamicContent } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { createStream } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { TableStream } from '../../interfaces/table.interface';
import { ImportBuilderOptions } from '../../interfaces/import-builder-options.interface';
import chalk from 'chalk';
import { isEqual } from 'lodash';

export const command = 'import [dir]';

export const desc = 'Import Content Type Schemas';

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Path to Content Type Schema definitions',
    type: 'string',
    demandOption: true
  });
};

const doCreate = async (hub: Hub, schema: ContentTypeSchema): Promise<string[]> => {
  try {
    const createdSchemaType = await hub.related.contentTypeSchema.create(new ContentTypeSchema(schema));
    return [createdSchemaType.id || '', schema.schemaId || '', 'CREATE', 'SUCCESS'];
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
    console.log('pre update', retrievedSchema);
    const updatedSchema = await retrievedSchema.related.update(schema);
    console.log('all done');
    return [updatedSchema.id || '', schema.schemaId || '', 'UPDATE', 'SUCCESS'];
  } catch (err) {
    throw new Error(`Error updating content type schema ${schema.schemaId || '<unknown>'}: ${err.message}`);
  }
};

export const handler = async (argv: Arguments<ImportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;
  const importedSchemas = extractImportObjects<ContentTypeSchema>(dir);
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedSchemaList = await paginator(hub.related.contentTypeSchema.list);

  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;
  tableStream.write([chalk.bold('id'), chalk.bold('schemaId'), chalk.bold('method'), chalk.bold('status')]);

  const schemasToProcess: ContentTypeSchema[] = importedSchemas.map(imported => {
    const found = storedSchemaList.find(stored => stored.schemaId === imported.schemaId);
    return found ? { ...found.toJSON(), ...imported } : imported;
  });

  for (const schema of schemasToProcess) {
    const result = schema.id ? doUpdate(client, schema) : doCreate(hub, schema);
    tableStream.write(await result);
  }

  process.stdout.write('\n');
};
