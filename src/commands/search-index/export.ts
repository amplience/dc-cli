import chalk from 'chalk';
import { HalResource, Hub, Page, Pageable, SearchIndex, SearchIndexSettings, Sortable } from 'dc-management-sdk-js';
import { AssignedContentType } from 'dc-management-sdk-js/build/main/lib/model/AssignedContentType';
import { SearchIndexKey } from 'dc-management-sdk-js/build/main/lib/model/SearchIndexKey';
import { isEqual } from 'lodash';
import { table } from 'table';
import { Arguments, Argv } from 'yargs';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { FileLog } from '../../common/file-log';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { streamTableOptions } from '../../common/table/table.consts';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import {
  ExportResult,
  nothingExportedExit,
  promptToOverwriteExports,
  uniqueFilenamePath,
  writeJsonToFile
} from '../../services/export.service';
import { loadJsonFromDirectory } from '../../services/import.service';
import { ConfigurationParameters } from '../configure';
import { validateNoDuplicateIndexNames } from './import';

export const command = 'export <dir>';

export const desc = 'Export Search Indices';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('search-index', 'export', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Output directory for the exported Search Index definitions',
      type: 'string'
    })
    .option('id', {
      type: 'string',
      describe:
        'The ID of a Search Index to be exported.\nIf no --id option is given, all search indices for the hub are exported.\nA single --id option may be given to export a single Search Index.\nMultiple --id options may be given to export multiple search indices at the same time.',
      requiresArg: true
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'Overwrite search indices without asking.'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: createLog
    });
};

const ensureJSON = (resource: HalResource): object => {
  return resource.toJSON != null ? resource.toJSON() : resource;
};

const equals = (a: EnrichedSearchIndex, b: EnrichedSearchIndex): boolean =>
  a.label === b.label &&
  isEqual(a.assignedContentTypes.map(x => ensureJSON(x)), b.assignedContentTypes.map(x => ensureJSON(x))) &&
  isEqual(ensureJSON(a.keys), ensureJSON(b.keys)) &&
  isEqual(ensureJSON(a.settings), ensureJSON(b.settings));

const searchIndexList = (hub: Hub, parentId?: string, projection?: string) => {
  return (options?: Pageable & Sortable): Promise<Page<SearchIndex>> =>
    hub.related.searchIndexes.list(parentId, projection, options);
};

export class EnrichedAssignedContentType extends AssignedContentType {
  webhook: string;
  activeContentWebhook: string;
  archivedContentWebhook: string;
}

export class EnrichedSearchIndex extends SearchIndex {
  settings: SearchIndexSettings;
  keys: SearchIndexKey;
  assignedContentTypes: EnrichedAssignedContentType[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public toJSON(): any {
    const result = super.toJSON();

    result.assignedContentTypes = result.assignedContentTypes.map((type: AssignedContentType) => type.toJSON());
    return result;
  }
}

export const filterIndicesById = (
  listToFilter: EnrichedSearchIndex[],
  indexIdList: string[]
): EnrichedSearchIndex[] => {
  if (indexIdList.length === 0) {
    return listToFilter;
  }

  const unmatchedIndexUriList: string[] = indexIdList.filter(id => !listToFilter.some(index => index.id === id));
  if (unmatchedIndexUriList.length > 0) {
    throw new Error(
      `The following ID(s) could not be found: [${unmatchedIndexUriList
        .map(u => `'${u}'`)
        .join(', ')}].\nNothing was exported, exiting.`
    );
  }

  return listToFilter.filter(index => indexIdList.some(id => index.id === id));
};

export const enrichIndex = async (index: SearchIndex): Promise<EnrichedSearchIndex> => {
  const enrichedIndex = new EnrichedSearchIndex(index);

  enrichedIndex.settings = await index.related.settings.get();
  const types = await paginator(index.related.assignedContentTypes.list);
  enrichedIndex.keys = await index.related.keys.get();

  const enrichedTypes: EnrichedAssignedContentType[] = [];

  for (const type of types) {
    const enriched = new EnrichedAssignedContentType(type);
    enriched.webhook = (await type.related.webhook()).id as string;
    enriched.activeContentWebhook = (await type.related.activeContentWebhook()).id as string;
    enriched.archivedContentWebhook = (await type.related.archivedContentWebhook()).id as string;

    enrichedTypes.push(enriched);
  }

  enrichedIndex.assignedContentTypes = enrichedTypes;

  return enrichedIndex;
};

interface ExportRecord {
  readonly filename: string;
  readonly status: ExportResult;
  readonly index: EnrichedSearchIndex;
}

export const getExportRecordForIndex = (
  index: EnrichedSearchIndex,
  outputDir: string,
  previouslyExportedIndices: { [filename: string]: EnrichedSearchIndex }
): ExportRecord => {
  const indexOfExportedIndex = Object.values(previouslyExportedIndices).findIndex(c => c.name === index.name);

  if (indexOfExportedIndex < 0) {
    const filename = uniqueFilenamePath(outputDir, index.name, 'json', Object.keys(previouslyExportedIndices));

    // This filename is now used.
    previouslyExportedIndices[filename] = index;

    return {
      filename: filename,
      status: 'CREATED',
      index
    };
  }
  const filename = Object.keys(previouslyExportedIndices)[indexOfExportedIndex];
  const previouslyExportedIndex = Object.values(previouslyExportedIndices)[indexOfExportedIndex];

  if (equals(previouslyExportedIndex, index)) {
    return { filename, status: 'UP-TO-DATE', index };
  }

  return {
    filename,
    status: 'UPDATED',
    index
  };
};

type ExportsMap = {
  uri: string;
  filename: string;
};

export const getIndexExports = (
  outputDir: string,
  previouslyExportedIndices: { [filename: string]: EnrichedSearchIndex },
  indicesBeingExported: EnrichedSearchIndex[]
): [ExportRecord[], ExportsMap[]] => {
  const allExports: ExportRecord[] = [];
  const updatedExportsMap: ExportsMap[] = []; // uri x filename
  for (const index of indicesBeingExported) {
    if (!index.name) {
      continue;
    }

    const exportRecord = getExportRecordForIndex(index, outputDir, previouslyExportedIndices);

    allExports.push(exportRecord);

    if (exportRecord.status === 'UPDATED') {
      updatedExportsMap.push({ uri: index.name, filename: exportRecord.filename });
    }
  }
  return [allExports, updatedExportsMap];
};

export const processIndices = async (
  outputDir: string,
  previouslyExportedIndices: { [filename: string]: EnrichedSearchIndex },
  indicesBeingExported: EnrichedSearchIndex[],
  log: FileLog,
  force: boolean
): Promise<void> => {
  if (indicesBeingExported.length === 0) {
    nothingExportedExit(log, 'No search indices to export from this hub, exiting.');
    return;
  }

  const [allExports, updatedExportsMap] = getIndexExports(outputDir, previouslyExportedIndices, indicesBeingExported);
  if (
    allExports.length === 0 ||
    (Object.keys(updatedExportsMap).length > 0 && !(force || (await promptToOverwriteExports(updatedExportsMap, log))))
  ) {
    nothingExportedExit(log);
    return;
  }

  await ensureDirectoryExists(outputDir);

  const data: string[][] = [];

  data.push([chalk.bold('File'), chalk.bold('Name'), chalk.bold('Result')]);
  for (const { filename, status, index } of allExports) {
    if (status !== 'UP-TO-DATE') {
      delete index.id; // do not export id
      writeJsonToFile(filename, index);
    }
    data.push([filename, index.name as string, status]);
  }

  log.appendLine(table(data, streamTableOptions));
};

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, id, logFile, force } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = logFile.open();

  const previouslyExportedIndices = loadJsonFromDirectory<EnrichedSearchIndex>(dir, EnrichedSearchIndex);
  validateNoDuplicateIndexNames(previouslyExportedIndices);

  const storedIndices = await paginator(searchIndexList(hub));
  const enrichedIndices = await Promise.all(storedIndices.map(enrichIndex));

  const idArray: string[] = id ? (Array.isArray(id) ? id : [id]) : [];
  const filteredIndices = filterIndicesById(enrichedIndices, idArray);
  await processIndices(dir, previouslyExportedIndices, filteredIndices, log, force || false);

  await log.close();
};
