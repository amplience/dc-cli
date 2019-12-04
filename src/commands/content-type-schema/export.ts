import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import { createStream } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { TableStream } from '../../interfaces/table.interface';
import chalk from 'chalk';
import {
  ExportResult,
  nothingExportedExit,
  promptToOverwriteExports,
  uniqueFilename,
  writeJsonToFile
} from '../../services/export.service';
import { loadJsonFromDirectory } from '../../services/import.service';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import * as path from 'path';
import * as fs from 'fs';
import { resolveSchemaBody } from '../../services/resolve-schema-body';

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
      describe:
        'The Schema ID of a Content Type Schema to be exported.\nIf no --schemaId option is given, all content type schemas for the hub are exported.\nA single --schemaId option may be given to export a single content type schema.\nMultiple --schemaId options may be given to export multiple content type schemas at the same time.',
      requiresArg: true
    });
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

const SCHEMA_DIR = 'schemas';

export const generateSchemaPath = (filepath: string): string =>
  SCHEMA_DIR + path.sep + path.basename(filepath).replace('.json', '-schema.json');

export const writeSchemaBody = (filename: string, body?: string): void => {
  if (!body) {
    return;
  }

  const dir = path.dirname(filename);
  if (fs.existsSync(dir)) {
    const dirStat = fs.lstatSync(dir);
    if (!dirStat || !dirStat.isDirectory()) {
      throw new Error(`Unable to write schema to "${filename}" as "${dir}" is not a directory.`);
    }
  } else {
    fs.mkdirSync(dir);
  }

  try {
    fs.writeFileSync(filename, body);
  } catch {
    throw new Error(`Unable to write file: ${filename}, aborting export`);
  }
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
    return {
      filename: uniqueFilename(
        outputDir,
        contentTypeSchema.schemaId,
        'json',
        Object.keys(previouslyExportedContentTypeSchemas)
      ),
      status: 'CREATED',
      contentTypeSchema
    };
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
  listToMatch: string[] = []
): ContentTypeSchema[] => {
  if (listToMatch.length === 0) {
    return listToFilter;
  }

  const unmatchedIdList: string[] = listToMatch.filter(id => !listToFilter.some(schema => schema.schemaId === id));
  if (unmatchedIdList.length > 0) {
    throw new Error(
      `The following schema ID(s) could not be found: [${unmatchedIdList
        .map(u => `'${u}'`)
        .join(', ')}].\nNothing was exported, exiting.`
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
    if (!contentTypeSchema.schemaId) {
      continue;
    }

    const exportRecord = getExportRecordForContentTypeSchema(
      contentTypeSchema,
      outputDir,
      previouslyExportedContentTypeSchemas
    );
    allExports.push(exportRecord);
    if (exportRecord.status === 'UPDATED') {
      updatedExportsMap.push({ schemaId: contentTypeSchema.schemaId, filename: exportRecord.filename });
    }
  }
  return [allExports, updatedExportsMap];
};

export const processContentTypeSchemas = async (
  outputDir: string,
  previouslyExportedContentTypeSchemas: { [filename: string]: ContentTypeSchema },
  storedContentTypeSchemas: ContentTypeSchema[]
): Promise<void> => {
  if (storedContentTypeSchemas.length === 0) {
    nothingExportedExit('No content type schemas to export from this hub, exiting.\n');
  }

  const [allExports, updatedExportsMap] = getContentTypeSchemaExports(
    outputDir,
    previouslyExportedContentTypeSchemas,
    storedContentTypeSchemas
  );
  if (
    allExports.length === 0 ||
    (Object.keys(updatedExportsMap).length > 0 && !(await promptToOverwriteExports(updatedExportsMap)))
  ) {
    nothingExportedExit();
  }

  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;
  tableStream.write([chalk.bold('file'), chalk.bold('schemaId'), chalk.bold('result')]);
  for (const { filename, status, contentTypeSchema } of allExports) {
    if (status !== 'UP-TO-DATE') {
      delete contentTypeSchema.id; // do not export id
      const schemaBody = contentTypeSchema.body;
      const schemaBodyFilename = generateSchemaPath(filename);
      contentTypeSchema.body = './' + schemaBodyFilename;
      writeSchemaBody(outputDir + path.sep + schemaBodyFilename, schemaBody);
      writeJsonToFile(filename, new ContentTypeSchema(contentTypeSchema));
    }
    tableStream.write([filename, contentTypeSchema.schemaId || '', status]);
  }
  process.stdout.write('\n');
};

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, schemaId } = argv;
  const [contentTypeSchemas] = await resolveSchemaBody(
    loadJsonFromDirectory<ContentTypeSchema>(dir, ContentTypeSchema),
    dir
  );
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedContentTypeSchemas = await paginator(hub.related.contentTypeSchema.list);
  const schemaIdArray: string[] = schemaId ? (Array.isArray(schemaId) ? schemaId : [schemaId]) : [];
  const filteredContentTypeSchemas = filterContentTypeSchemasBySchemaId(storedContentTypeSchemas, schemaIdArray);
  await processContentTypeSchemas(dir, contentTypeSchemas, filteredContentTypeSchemas);
};
