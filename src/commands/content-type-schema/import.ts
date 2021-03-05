import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentTypeSchema, DynamicContent, Hub, ValidationLevel } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { table } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { ImportBuilderOptions } from '../../interfaces/import-builder-options.interface';
import chalk from 'chalk';
import { createContentTypeSchema } from './create.service';
import { updateContentTypeSchema } from './update.service';
import { ImportResult, loadJsonFromDirectory, UpdateStatus } from '../../services/import.service';
import { resolveSchemaBody } from '../../services/resolve-schema-body';
import { FileLog } from '../../common/file-log';
import { getDefaultLogPath } from '../../common/log-helpers';
import { ResourceStatus, Status } from '../../common/dc-management-sdk-js/resource-status';

export const command = 'import <dir>';

export const desc = 'Import Content Type Schemas';

export interface SchemaOptions {
  validation: ValidationLevel;
}

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('schema', 'import', platform);

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Directory containing Content Type Schema definitions',
    type: 'string'
  });

  yargs.option('logFile', {
    type: 'string',
    default: LOG_FILENAME,
    describe: 'Path to a log file to write to.'
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

export const doCreate = async (hub: Hub, schema: ContentTypeSchema, log: FileLog): Promise<ContentTypeSchema> => {
  try {
    const createdSchemaType = await createContentTypeSchema(
      schema.body || '',
      schema.validationLevel || ValidationLevel.CONTENT_TYPE,
      hub
    );

    log.addAction('CREATE', `${createdSchemaType.id}`);

    return createdSchemaType;
  } catch (err) {
    throw new Error(`Error registering content type schema with body: ${schema.body}\n\n${err}`);
  }
};

const equals = (a: ContentTypeSchema, b: ContentTypeSchema): boolean =>
  a.id === b.id && a.schemaId === b.schemaId && a.body === b.body && a.validationLevel === b.validationLevel;

export const doUpdate = async (
  client: DynamicContent,
  schema: ContentTypeSchema,
  log: FileLog
): Promise<{ contentTypeSchema: ContentTypeSchema; updateStatus: UpdateStatus }> => {
  try {
    let retrievedSchema: ContentTypeSchema = await client.contentTypeSchemas.get(schema.id || '');
    if (equals(retrievedSchema, schema)) {
      return { contentTypeSchema: retrievedSchema, updateStatus: UpdateStatus.SKIPPED };
    }

    if ((retrievedSchema as ResourceStatus).status === Status.ARCHIVED) {
      try {
        // Resurrect this schema before updating it.
        retrievedSchema = await retrievedSchema.related.unarchive();
      } catch (err) {
        throw new Error(`Error unable unarchive content type ${schema.id}: ${err.message}`);
      }
    }

    const updatedSchema = await updateContentTypeSchema(
      retrievedSchema,
      schema.body || '',
      schema.validationLevel || ValidationLevel.CONTENT_TYPE
    );

    log.addAction('UPDATE', `${retrievedSchema.id} ${retrievedSchema.version} ${updatedSchema.version}`);

    return { contentTypeSchema: updatedSchema, updateStatus: UpdateStatus.UPDATED };
  } catch (err) {
    throw new Error(`Error updating content type schema ${schema.schemaId || '<unknown>'}: ${err.message}`);
  }
};

export const processSchemas = async (
  schemasToProcess: ContentTypeSchema[],
  client: DynamicContent,
  hub: Hub,
  log: FileLog
): Promise<void> => {
  const data: string[][] = [];

  data.push([chalk.bold('ID'), chalk.bold('Schema ID'), chalk.bold('Result')]);
  for (const schema of schemasToProcess) {
    let status: ImportResult;
    let contentTypeSchema: ContentTypeSchema;
    if (schema.id) {
      const result = await doUpdate(client, schema, log);
      contentTypeSchema = result.contentTypeSchema;
      status = result.updateStatus === UpdateStatus.SKIPPED ? 'UP-TO-DATE' : 'UPDATED';
    } else {
      contentTypeSchema = await doCreate(hub, schema, log);
      status = 'CREATED';
    }
    data.push([contentTypeSchema.id || '', contentTypeSchema.schemaId || '', status]);
  }

  log.appendLine(table(data, streamTableOptions));
};

export const handler = async (argv: Arguments<ImportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, logFile } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;
  const schemas = loadJsonFromDirectory<ContentTypeSchema>(dir, ContentTypeSchema);
  const [resolvedSchemas, resolveSchemaErrors] = await resolveSchemaBody(schemas, dir);
  if (Object.keys(resolveSchemaErrors).length > 0) {
    const errors = Object.entries(resolveSchemaErrors)
      .map(value => {
        const [filename, error] = value;
        return `* ${filename} -> ${error}`;
      })
      .join('\n');
    throw new Error(`Unable to resolve the body for the following files:\n${errors}`);
  }
  const storedSchemas = await paginator(hub.related.contentTypeSchema.list);
  const schemasToProcess = Object.values(resolvedSchemas).map(resolvedSchema =>
    storedSchemaMapper(resolvedSchema, storedSchemas)
  );

  await processSchemas(schemasToProcess, client, hub, log);

  if (typeof logFile !== 'object') {
    // Only close the log if it was opened by this handler.
    await log.close();
  }
};
