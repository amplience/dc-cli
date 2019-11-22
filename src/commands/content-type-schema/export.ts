import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ImportBuilderOptions } from '../../interfaces/import-builder-options.interface';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import { createStream } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { TableStream } from '../../interfaces/table.interface';
import chalk from 'chalk';
import { ExportResult, uniqueFilename, writeJsonToFile } from '../../services/export.service';
import { loadJsonFromDirectory } from '../../services/import.service';

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
}

export const getExportRecordForContentTypeSchema = (
  contentTypeSchema: ContentTypeSchema,
  outputDir: string,
  previouslyExportedContentTypeSchemas: { [filename: string]: ContentTypeSchema }
): ExportRecord => {
  const indexOfExportedContentTypeSchema = Object.values(previouslyExportedContentTypeSchemas).findIndex(
    c => c.schemaId === contentTypeSchema.schemaId
  );
  if (indexOfExportedContentTypeSchema < 0) {
    return { filename: uniqueFilename(outputDir, 'json'), status: 'CREATED' };
  }
  const filename = Object.keys(previouslyExportedContentTypeSchemas)[indexOfExportedContentTypeSchema];
  const previouslyExportedContentTypeSchema = Object.values(previouslyExportedContentTypeSchemas)[
    indexOfExportedContentTypeSchema
  ];
  if (equals(previouslyExportedContentTypeSchema, contentTypeSchema)) {
    return { filename, status: 'UP-TO-DATE' };
  }
  return {
    filename,
    status: 'UPDATED'
  };
};

export const processContentTypeSchemas = async (
  outputDir: string,
  previouslyExportedContentTypeSchemas: { [filename: string]: ContentTypeSchema },
  storedContentTypeSchemas: ContentTypeSchema[]
): Promise<void> => {
  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;
  tableStream.write([chalk.bold('file'), chalk.bold('schemaId'), chalk.bold('result')]);
  for (const contentTypeSchema of storedContentTypeSchemas) {
    const exportRecord = getExportRecordForContentTypeSchema(
      contentTypeSchema,
      outputDir,
      previouslyExportedContentTypeSchemas
    );
    if (exportRecord.status !== 'UP-TO-DATE') {
      delete contentTypeSchema.id; // do not export id
      writeJsonToFile(exportRecord.filename, new ContentTypeSchema(contentTypeSchema));
    }
    tableStream.write([exportRecord.filename, contentTypeSchema.schemaId || '', exportRecord.status]);
  }
  process.stdout.write('\n');
};

export const handler = async (argv: Arguments<ImportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;
  const previouslyExportedContentTypeSchemas = loadJsonFromDirectory<ContentTypeSchema>(dir, ContentTypeSchema);
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedContentTypeSchemas = await paginator(hub.related.contentTypeSchema.list);
  await processContentTypeSchemas(dir, previouslyExportedContentTypeSchemas, storedContentTypeSchemas);
};
