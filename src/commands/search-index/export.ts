import chalk from 'chalk';
import {
  HalResource,
  Hub,
  Page,
  Pageable,
  SearchIndex,
  SearchIndexSettings,
  Sortable,
  Webhook
} from 'dc-management-sdk-js';
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
import { join } from 'path';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';

export const command = 'export <dir>';

export const desc = 'Export Search Indexes';

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
        'The ID of a Search Index to be exported.\nIf no --id option is given, all search indexes for the hub are exported.\nA single --id option may be given to export a single Search Index.\nMultiple --id options may be given to export multiple search indexes at the same time.',
      requiresArg: true
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'Overwrite search indexes without asking.'
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

export const webhookEquals = (a?: Webhook, b?: Webhook): boolean => {
  if (a === undefined) {
    return b === undefined;
  } else if (b === undefined) {
    return false;
  }

  return (
    a.method === b.method &&
    a.secret === b.secret &&
    a.label === b.label &&
    a.active === b.active &&
    isEqual(a.customPayload, b.customPayload) &&
    isEqual(a.events, b.events) &&
    isEqual(a.filters, b.filters) &&
    isEqual(a.handlers, b.handlers) &&
    isEqual(a.headers, b.headers)
  );
};

export const replicaEquals = (a: EnrichedReplica, b: EnrichedReplica, keys: boolean): boolean =>
  a.label === b.label &&
  (!keys || isEqual(ensureJSON(a.keys), ensureJSON(b.keys))) &&
  isEqual(ensureJSON(a.settings), ensureJSON(b.settings));

export const assignedContentTypeEquals = (
  a: EnrichedAssignedContentType,
  b: EnrichedAssignedContentType,
  aWebhooks?: Map<string, Webhook>,
  bWebhooks?: Map<string, Webhook>
): boolean =>
  !(aWebhooks && bWebhooks) ||
  (webhookEquals(aWebhooks.get(a.webhook), bWebhooks.get(b.webhook)) &&
    webhookEquals(aWebhooks.get(a.activeContentWebhook), bWebhooks.get(b.activeContentWebhook)) &&
    webhookEquals(aWebhooks.get(a.archivedContentWebhook), bWebhooks.get(b.archivedContentWebhook)));

export const ensureSettings = (settings: SearchIndexSettings): object => {
  const result = ensureJSON(settings) as SearchIndexSettings;
  result.replicas = result.replicas || [];
  return result;
};

export const equals = (
  a: EnrichedSearchIndex,
  b: EnrichedSearchIndex,
  keys = true,
  aWebhooks?: Map<string, Webhook>,
  bWebhooks?: Map<string, Webhook>
): boolean =>
  a.label === b.label &&
  a.assignedContentTypes
    .map((x, i) => assignedContentTypeEquals(x, b.assignedContentTypes[i], aWebhooks, bWebhooks))
    .reduce((a, b) => a && b, true) &&
  a.replicas.length == b.replicas.length &&
  a.replicas.map((x, i) => replicaEquals(x, b.replicas[i], keys)).reduce((a, b) => a && b, true) &&
  (!keys || isEqual(ensureJSON(a.keys), ensureJSON(b.keys))) &&
  isEqual(ensureSettings(a.settings), ensureSettings(b.settings));

const searchIndexList = (hub: Hub, parentId?: string, projection?: string) => {
  return (options?: Pageable & Sortable): Promise<Page<SearchIndex>> =>
    hub.related.searchIndexes.list(parentId, projection, options);
};

export class EnrichedAssignedContentType extends AssignedContentType {
  webhook: string;
  activeContentWebhook: string;
  archivedContentWebhook: string;
}

export class EnrichedReplica extends SearchIndex {
  settings: SearchIndexSettings;
  keys: SearchIndexKey;
}

export class EnrichedSearchIndex extends SearchIndex {
  settings: SearchIndexSettings;
  keys: SearchIndexKey;
  assignedContentTypes: EnrichedAssignedContentType[];
  replicas: EnrichedReplica[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public toJSON(): any {
    const result = super.toJSON();

    result.assignedContentTypes = result.assignedContentTypes.map((type: AssignedContentType) => type.toJSON());
    return result;
  }
}

export const filterIndexesById = (listToFilter: SearchIndex[], indexIdList: string[]): SearchIndex[] => {
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

export const registerWebhook = (mapping: Map<string, Webhook>, webhook: Webhook): string => {
  mapping.set(webhook.id as string, webhook);

  return webhook.id as string;
};

export const enrichReplica = async (replica: SearchIndex): Promise<EnrichedReplica> => {
  const enrichedReplica = new EnrichedReplica(replica);

  enrichedReplica.settings = await replica.related.settings.get();
  enrichedReplica.keys = await replica.related.keys.get();

  return enrichedReplica;
};

export const enrichIndex = async (
  webhooks: Map<string, Webhook>,
  allReplicas: Map<string, SearchIndex[]>,
  index: SearchIndex
): Promise<EnrichedSearchIndex> => {
  const enrichedIndex = new EnrichedSearchIndex(index);

  enrichedIndex.settings = await index.related.settings.get();
  const types = await paginator(index.related.assignedContentTypes.list);
  enrichedIndex.keys = await index.related.keys.get();

  const replicas = allReplicas.get(index.id as string);
  if (replicas) {
    enrichedIndex.replicas = await Promise.all(replicas.map(enrichReplica));
  } else {
    enrichedIndex.replicas = [];
  }

  const enrichedTypes: EnrichedAssignedContentType[] = [];

  for (const type of types) {
    const enriched = new EnrichedAssignedContentType(type);
    enriched.webhook = registerWebhook(webhooks, await type.related.webhook());
    enriched.activeContentWebhook = registerWebhook(webhooks, await type.related.activeContentWebhook());
    enriched.archivedContentWebhook = registerWebhook(webhooks, await type.related.archivedContentWebhook());

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
  previouslyExportedIndexes: { [filename: string]: EnrichedSearchIndex },
  previouslyExportedWebhooks: Map<string, Webhook>,
  webhooksBeingExported: Map<string, Webhook>
): ExportRecord => {
  const indexOfExportedIndex = Object.values(previouslyExportedIndexes).findIndex(c => c.name === index.name);

  if (indexOfExportedIndex < 0) {
    const filename = uniqueFilenamePath(outputDir, index.name, 'json', Object.keys(previouslyExportedIndexes));

    // This filename is now used.
    previouslyExportedIndexes[filename] = index;

    return {
      filename: filename,
      status: 'CREATED',
      index
    };
  }
  const filename = Object.keys(previouslyExportedIndexes)[indexOfExportedIndex];
  const previouslyExportedIndex = Object.values(previouslyExportedIndexes)[indexOfExportedIndex];

  if (equals(previouslyExportedIndex, index, true, previouslyExportedWebhooks, webhooksBeingExported)) {
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

export const getExportedWebhooks = (outputDir: string): Map<string, Webhook> => {
  const exportedWebhooks = loadJsonFromDirectory<Webhook>(join(outputDir, 'webhooks'), Webhook);
  const webhookList = Object.values(exportedWebhooks);

  const webhooks = new Map<string, Webhook>();

  for (const webhook of webhookList) {
    if (webhook.id) {
      webhooks.set(webhook.id, webhook);
    }
  }

  return webhooks;
};

export const getIndexExports = (
  outputDir: string,
  previouslyExportedIndexes: { [filename: string]: EnrichedSearchIndex },
  indexesBeingExported: EnrichedSearchIndex[],
  webhooksBeingExported: Map<string, Webhook>
): [ExportRecord[], ExportsMap[]] => {
  const allExports: ExportRecord[] = [];
  const updatedExportsMap: ExportsMap[] = []; // uri x filename
  const previouslyExportedWebhooks = getExportedWebhooks(outputDir);

  for (const index of indexesBeingExported) {
    if (!index.name) {
      continue;
    }

    const exportRecord = getExportRecordForIndex(
      index,
      outputDir,
      previouslyExportedIndexes,
      previouslyExportedWebhooks,
      webhooksBeingExported
    );

    allExports.push(exportRecord);

    if (exportRecord.status === 'UPDATED') {
      updatedExportsMap.push({ uri: index.name, filename: exportRecord.filename });
    }
  }
  return [allExports, updatedExportsMap];
};

export const processIndexes = async (
  outputDir: string,
  previouslyExportedIndexes: { [filename: string]: EnrichedSearchIndex },
  indexesBeingExported: EnrichedSearchIndex[],
  webhooksBeingExported: Map<string, Webhook>,
  log: FileLog,
  force: boolean
): Promise<void> => {
  if (indexesBeingExported.length === 0) {
    nothingExportedExit(log, 'No search indexes to export from this hub, exiting.');
    return;
  }

  const [allExports, updatedExportsMap] = getIndexExports(
    outputDir,
    previouslyExportedIndexes,
    indexesBeingExported,
    webhooksBeingExported
  );
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
    } else {
      indexesBeingExported.splice(indexesBeingExported.indexOf(index), 1);
    }
    data.push([filename, index.name as string, status]);
  }

  log.appendLine(table(data, streamTableOptions));
};

export const filterWebhooks = (
  webhooks: Map<string, Webhook>,
  filteredIndexes: EnrichedSearchIndex[]
): Map<string, Webhook> => {
  const filtered = new Map<string, Webhook>();

  for (const index of filteredIndexes) {
    for (const type of index.assignedContentTypes) {
      filtered.set(type.webhook, webhooks.get(type.webhook) as Webhook);
      filtered.set(type.activeContentWebhook, webhooks.get(type.activeContentWebhook) as Webhook);
      filtered.set(type.archivedContentWebhook, webhooks.get(type.archivedContentWebhook) as Webhook);
    }
  }

  return filtered;
};

export const processWebhooks = async (
  outputDir: string,
  webhooksBeingExported: Webhook[],
  log: FileLog
): Promise<void> => {
  if (webhooksBeingExported.length === 0) {
    return;
  }

  log.appendLine('Exporting Webhooks...');

  const previouslyExportedWebhooks: { [filename: string]: Webhook } = {};
  const base = join(outputDir, 'webhooks');
  await ensureDirectoryExists(base);

  const data: string[][] = [];

  data.push([chalk.bold('File'), chalk.bold('Label'), chalk.bold('Result')]);
  for (const webhook of webhooksBeingExported) {
    const filename = uniqueFilenamePath(base, webhook.label, 'json', Object.keys(previouslyExportedWebhooks));
    previouslyExportedWebhooks[filename] = webhook;
    writeJsonToFile(filename, webhook);
    data.push([filename, webhook.label as string, 'UPDATED']);
  }

  log.appendLine(table(data, streamTableOptions));
};

export const separateReplicas = (
  allIndexes: SearchIndex[]
): { storedIndexes: SearchIndex[]; allReplicas: Map<string, SearchIndex[]> } => {
  const storedIndexes: SearchIndex[] = [];
  const allReplicas = new Map<string, SearchIndex[]>();
  for (const index of allIndexes) {
    if (index.parentId == null) {
      storedIndexes.push(index);
    } else {
      let list = allReplicas.get(index.parentId);

      if (list == null) {
        list = [];
        allReplicas.set(index.parentId, list);
      }

      list.push(index);
    }
  }

  return { storedIndexes, allReplicas };
};

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, id, logFile, force } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = logFile.open();

  const previouslyExportedIndexes = loadJsonFromDirectory<EnrichedSearchIndex>(dir, EnrichedSearchIndex);
  validateNoDuplicateIndexNames(previouslyExportedIndexes);

  const allStoredIndexes = await paginator(searchIndexList(hub));
  const { storedIndexes, allReplicas } = separateReplicas(allStoredIndexes);

  const idArray: string[] = id ? (Array.isArray(id) ? id : [id]) : [];
  const filteredIndexes = filterIndexesById(storedIndexes, idArray);

  const webhooks = new Map<string, Webhook>();
  const enrichedIndexes = await Promise.all(filteredIndexes.map(index => enrichIndex(webhooks, allReplicas, index)));

  await processIndexes(dir, previouslyExportedIndexes, enrichedIndexes, webhooks, log, force || false);

  const filteredWebhooks = filterWebhooks(webhooks, enrichedIndexes);
  await processWebhooks(dir, Array.from(filteredWebhooks.values()), log);

  await log.close();
};
