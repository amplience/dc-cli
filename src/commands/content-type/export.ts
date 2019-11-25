import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentType } from 'dc-management-sdk-js';
import { createStream } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { TableStream } from '../../interfaces/table.interface';
import chalk from 'chalk';
import { ExportResult, uniqueFilename, writeJsonToFile } from '../../services/export.service';
import { loadJsonFromDirectory } from '../../services/import.service';
import { validateNoDuplicateContentTypeUris } from './import';
import { isEqual } from 'lodash';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import readline from 'readline';
import DataPresenter from '../../view/data-presenter';

export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

export const command = 'export <dir>';

export const desc = 'Export Content Types';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Output directory for the exported Content Type definitions',
      type: 'string'
    })
    .option('schemaId', {
      type: 'string',
      describe: 'content-type-schema ID(s) of Content Type(s) to export',
      requiresArg: true
    })
    .array<string>('schemaId');
};

const equals = (a: ContentType, b: ContentType): boolean =>
  a.contentTypeUri === b.contentTypeUri && isEqual(a.settings, b.settings);

interface ExportRecord {
  readonly filename: string;
  readonly status: ExportResult;
  readonly contentType: ContentType;
}

export const getExportRecordForContentType = (
  contentType: ContentType,
  outputDir: string,
  previouslyExportedContentTypes: { [filename: string]: ContentType }
): ExportRecord => {
  const indexOfExportedContentType = Object.values(previouslyExportedContentTypes).findIndex(
    c => c.contentTypeUri === contentType.contentTypeUri
  );
  if (indexOfExportedContentType < 0) {
    return { filename: uniqueFilename(outputDir, 'json'), status: 'CREATED', contentType };
  }
  const filename = Object.keys(previouslyExportedContentTypes)[indexOfExportedContentType];
  const previouslyExportedContentType = Object.values(previouslyExportedContentTypes)[indexOfExportedContentType];
  if (equals(previouslyExportedContentType, contentType)) {
    return { filename, status: 'UP-TO-DATE', contentType };
  }
  return {
    filename,
    status: 'UPDATED',
    contentType
  };
};

export const filterContentTypesByUri = (listToFilter: ContentType[], contentTypeUriList: string[]): ContentType[] => {
  let unmatchedContentTypeUriList: string[] = [];
  let filteredList: ContentType[] = [];
  if (contentTypeUriList.length > 0) {
    filteredList = listToFilter.filter(contentType =>
      contentTypeUriList.some(uri => contentType.contentTypeUri === uri)
    );
    unmatchedContentTypeUriList = contentTypeUriList.filter(
      uri => !listToFilter.some(contentType => contentType.contentTypeUri === uri)
    );
    if (unmatchedContentTypeUriList.length > 0) {
      throw new Error(
        `The following schema ID(s) could not be found: [${unmatchedContentTypeUriList.map(u => `'${u}'`).join(', ')}].`
      );
    }
  }
  return filteredList;
};

const getExports = (
  outputDir: string,
  previouslyExportedContentTypes: { [filename: string]: ContentType },
  contentTypesBeingExported: ContentType[]
): [ExportRecord[], Map<string, string>] => {
  const allExports: ExportRecord[] = [];
  const updatedExportsMap = new Map<string, string>(); // uri x filename
  for (const contentType of contentTypesBeingExported) {
    const exportRecord = getExportRecordForContentType(contentType, outputDir, previouslyExportedContentTypes);
    if (contentType.contentTypeUri) {
      allExports.push(exportRecord);
      if (exportRecord.status === 'UPDATED') {
        updatedExportsMap.set(contentType.contentTypeUri, exportRecord.filename);
      }
    }
  }
  return [allExports, updatedExportsMap];
};

const promptToOverwriteExports = async (updatedExportsMap: Map<string, string>): Promise<boolean> => {
  process.stdout.write('The following files will be overwritten:');
  // display updatedExportsMap as a table of uri x filename
  new DataPresenter(updatedExportsMap).render();
  return new Promise((resolve, reject) => {
    rl.question('Do you want to continue (y/n)?: ', answer => {
      rl.close();
      return resolve(answer === 'y');
    });
  });
};

export const processContentTypes = async (
  outputDir: string,
  previouslyExportedContentTypes: { [filename: string]: ContentType },
  contentTypesBeingExported: ContentType[]
): Promise<void> => {
  const tableStream = (createStream(streamTableOptions) as unknown) as TableStream;
  tableStream.write([chalk.bold('file'), chalk.bold('contentTypeUri'), chalk.bold('result')]);

  const [allExports, updatedExportsMap] = getExports(
    outputDir,
    previouslyExportedContentTypes,
    contentTypesBeingExported
  );
  if (updatedExportsMap.size > 0 && !(await promptToOverwriteExports(updatedExportsMap))) {
    return;
  }

  for (const { filename, status, contentType } of allExports) {
    if (status !== 'UP-TO-DATE') {
      /* eslint-disable @typescript-eslint/no-unused-vars */ // id is intentionally thrown away on the next line
      const { id, ...exportedContentType } = contentType; // do not export id
      writeJsonToFile(filename, new ContentType(exportedContentType));
    }
    tableStream.write([filename, contentType.contentTypeUri || '', status]);
  }
  process.stdout.write('\n');
};

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, schemaId } = argv;
  const previouslyExportedContentTypes = loadJsonFromDirectory<ContentType>(dir, ContentType);
  validateNoDuplicateContentTypeUris(previouslyExportedContentTypes);

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedContentTypes = await paginator(hub.related.contentTypes.list);
  const filteredContentTypes = filterContentTypesByUri(storedContentTypes, schemaId);
  await processContentTypes(dir, previouslyExportedContentTypes, filteredContentTypes);
};
