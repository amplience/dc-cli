import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import { createStream } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { TableStream } from '../../interfaces/table.interface';
import chalk from 'chalk';
import { ExportResult, uniqueFilename, writeJsonToFile } from '../../services/export.service';
import { loadJsonFromDirectory } from '../../services/import.service';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import { promptToOverwriteExports } from '../../common/export/overwrite-prompt';

export const command = 'export <dir>';

export const desc = 'Export Content Type Schemas';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Output directory for the exported Content Type Schema definitions',
      type: 'string'
    })
    .option('schemaId', {
      type: 'string',
      describe: 'content-type-schema ID(s) to export',
      requiresArg: true
    })
    .array<string>('schemaId');
};

const equals = (a: ContentTypeSchema, b: ContentTypeSchema): boolean =>
  a.schemaId === b.schemaId && a.body === b.body && a.validationLevel === b.validationLevel;

interface ExportRecord {
  readonly filename: string;
  readonly status: ExportResult;
  readonly contentTypeSchema: ContentTypeSchema;
}

type ExportsMap = {
  schemaId: string;
  filename: string;
};

export const getExportRecordForContentTypeSchema = (
  contentTypeSchema: ContentTypeSchema,
  outputDir: string,
  previouslyExportedContentTypeSchemas: { [filename: string]: ContentTypeSchema }
): ExportRecord => {
  const indexOfExportedContentTypeSchema = Object.values(previouslyExportedContentTypeSchemas).findIndex(
    c => c.schemaId === contentTypeSchema.schemaId
  );
  if (indexOfExportedContentTypeSchema < 0) {
    return { filename: uniqueFilename(outputDir, 'json'), status: 'CREATED', contentTypeSchema };
  }
  const filename = Object.keys(previouslyExportedContentTypeSchemas)[indexOfExportedContentTypeSchema];
  const previouslyExportedContentTypeSchema = Object.values(previouslyExportedContentTypeSchemas)[
    indexOfExportedContentTypeSchema
  ];
  if (equals(previouslyExportedContentTypeSchema, contentTypeSchema)) {
    return { filename, status: 'UP-TO-DATE', contentTypeSchema };
  }
  return {
    filename,
    status: 'UPDATED',
    contentTypeSchema
  };
};

export const filterContentTypeSchemasBySchemaId = (
  listToFilter: ContentTypeSchema[],
  listToMatch: string[]
): ContentTypeSchema[] => {
  if (!listToMatch.length) {
    return listToFilter;
  }

  const unmatchedIdList: string[] = listToMatch.filter(id => !listToFilter.some(schema => schema.schemaId === id));
  if (unmatchedIdList.length > 0) {
    throw new Error(
      `The following schema ID(s) could not be found: [${unmatchedIdList.map(u => `'${u}'`).join(', ')}].`
    );
  }

  return listToFilter.filter(schema => listToMatch.some(id => schema.schemaId === id));
};

export const getContentTypeSchemaExports = (
  outputDir: string,
  previouslyExportedContentTypeSchemas: { [filename: string]: ContentTypeSchema },
  contentTypeSchemasBeingExported: ContentTypeSchema[]
): [ExportRecord[], ExportsMap[]] => {
  const allExports: ExportRecord[] = [];
  const updatedExportsMap: ExportsMap[] = []; // uri x filename
  for (const contentTypeSchema of contentTypeSchemasBeingExported) {
    const exportRecord = getExportRecordForContentTypeSchema(
      contentTypeSchema,
      outputDir,
      previouslyExportedContentTypeSchemas
    );
    if (contentTypeSchema.schemaId) {
      allExports.push(exportRecord);
      if (exportRecord.status === 'UPDATED') {
        updatedExportsMap.push({ schemaId: contentTypeSchema.schemaId, filename: exportRecord.filename });
      }
    }
  }
  return [allExports, updatedExportsMap];
};

export const processContentTypeSchemas = async (
  outputDir: string,
  previouslyExportedContentTypeSchemas: { [filename: string]: ContentTypeSchema },
  storedContentTypeSchemas: ContentTypeSchema[]
): Promise<void> => {
  const [allExports, updatedExportsMap] = getContentTypeSchemaExports(
    outputDir,
    previouslyExportedContentTypeSchemas,
    storedContentTypeSchemas
  );
  if (Object.keys(updatedExportsMap).length > 0 && !(await promptToOverwriteExports(updatedExportsMap))) {
    process.exit(1);
  }

  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;
  tableStream.write([chalk.bold('file'), chalk.bold('schemaId'), chalk.bold('result')]);
  for (const { filename, status, contentTypeSchema } of allExports) {
    if (status !== 'UP-TO-DATE') {
      delete contentTypeSchema.id; // do not export id
      writeJsonToFile(filename, new ContentTypeSchema(contentTypeSchema));
    }
    tableStream.write([filename, contentTypeSchema.schemaId || '', status]);
  }
  process.stdout.write('\n');
};

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, schemaId } = argv;
  const previouslyExportedContentTypeSchemas = loadJsonFromDirectory<ContentTypeSchema>(dir, ContentTypeSchema);
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedContentTypeSchemas = await paginator(hub.related.contentTypeSchema.list);
  const filteredContentTypeSchemas = filterContentTypeSchemasBySchemaId(storedContentTypeSchemas, schemaId);
  await processContentTypeSchemas(dir, previouslyExportedContentTypeSchemas, filteredContentTypeSchemas);
};
