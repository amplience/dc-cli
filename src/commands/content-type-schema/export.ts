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

export const processContentTypeSchemas = async (
  outputDir: string,
  ContentTypeSchemas: ContentTypeSchema[]
): Promise<void> => {
  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;
  tableStream.write([chalk.bold('file'), chalk.bold('schemaId'), chalk.bold('result')]);
  for (const contentTypeSchema of ContentTypeSchemas) {
    const status: ExportResult = 'EXPORTED';
    const filename = uniqueFilename(outputDir, 'json');
    delete contentTypeSchema.id; // do not export id
    writeJsonToFile(filename, new ContentTypeSchema(contentTypeSchema));
    tableStream.write([filename, contentTypeSchema.schemaId || '', status]);
  }
  process.stdout.write('\n');
};

export const handler = async (argv: Arguments<ImportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedContentTypeSchemas = await paginator(hub.related.contentTypeSchema.list);
  await processContentTypeSchemas(dir, storedContentTypeSchemas);
};
