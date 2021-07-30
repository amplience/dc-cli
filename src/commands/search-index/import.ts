import chalk from 'chalk';
import { DynamicContent, Hub, Page, Pageable, SearchIndex, SearchIndexSettings, Sortable } from 'dc-management-sdk-js';
import { table } from 'table';
import { Arguments, Argv } from 'yargs';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { FileLog } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { streamTableOptions } from '../../common/table/table.consts';
import { ImportBuilderOptions } from '../../interfaces/import-builder-options.interface';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ImportResult, loadJsonFromDirectory, UpdateStatus } from '../../services/import.service';
import { ConfigurationParameters } from '../configure';
import { EnrichedSearchIndex, equals, enrichIndex as enrichServerIndex, separateReplicas } from './export';

export const command = 'import <dir>';

export const desc = 'Import Search Index';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('search-index', 'import', platform);

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Directory containing Search Indices',
    type: 'string'
  });

  yargs.option('logFile', {
    type: 'string',
    default: LOG_FILENAME,
    describe: 'Path to a log file to write to.',
    coerce: createLog
  });
};

const searchIndexList = (hub: Hub, parentId?: string, projection?: string) => {
  return (options?: Pageable & Sortable): Promise<Page<SearchIndex>> =>
    hub.related.searchIndexes.list(parentId, projection, options);
};

const replicaList = (index: SearchIndex, projection?: string) => {
  return (options?: Pageable & Sortable): Promise<Page<SearchIndex>> =>
    index.related.replicas.list(projection, options);
};

type IndexName = string;
type IndexFile = string;

export const validateNoDuplicateIndexNames = (importedIndices: {
  [filename: string]: EnrichedSearchIndex;
}): void | never => {
  const nameToFilenameMap = new Map<IndexName, IndexFile[]>(); // map: name x filenames
  for (const [filename, index] of Object.entries(importedIndices)) {
    if (index.name) {
      const otherFilenames: string[] = nameToFilenameMap.get(index.name) || [];
      if (filename) {
        nameToFilenameMap.set(index.name, [...otherFilenames, filename]);
      }
    }
  }
  const uniqueDuplicateNames: [string, IndexFile[]][] = [];
  nameToFilenameMap.forEach((filenames, name) => {
    if (filenames.length > 1) {
      uniqueDuplicateNames.push([name, filenames]);
    }
  });

  if (uniqueDuplicateNames.length > 0) {
    throw new Error(
      `Indices must have unique name values. Duplicate values found:-\n${uniqueDuplicateNames
        .map(([name, filenames]) => `  name: '${name}' in files: [${filenames.map(f => `'${f}'`).join(', ')}]`)
        .join('\n')}`
    );
  }
};

export const filterIndicesById = (
  idFilter: string[],
  importedIndices: {
    [filename: string]: SearchIndex;
  }
): void | never => {
  for (const [filename, index] of Object.entries(importedIndices)) {
    if (idFilter.indexOf(index.id as string) === -1) {
      delete importedIndices[filename];
    }
  }
};

export const storedIndexMapper = (index: EnrichedSearchIndex, storedIndices: SearchIndex[]): EnrichedSearchIndex => {
  const found = storedIndices.find(stored => stored.name === index.name);
  const mutatedIndex = found ? { ...index, id: found.id } : index;

  return new EnrichedSearchIndex(mutatedIndex);
};

const getIndexProperties = (index: SearchIndex): object => {
  return {
    label: index.label,
    name: index.name,
    suffix: index.suffix,
    type: index.type
  };
};

export const enrichIndex = async (index: SearchIndex, enrichedIndex: EnrichedSearchIndex): Promise<void> => {
  await index.related.settings.update(enrichedIndex.settings, false);

  if (enrichedIndex.settings.replicas && enrichedIndex.settings.replicas.length) {
    // Replica settings must also be updated. The replicas may have changed, so fetch them again.

    const replicas = await paginator(replicaList(index));

    for (const importReplica of enrichedIndex.replicas) {
      let replica = replicas.find(replica => replica.name === importReplica.name);

      if (replica) {
        replica = await replica.related.update(new SearchIndex(getIndexProperties(importReplica)));

        replica.related.settings.update(importReplica.settings, false);
      }
    }
  }

  const types = await paginator(index.related.assignedContentTypes.list);

  // Assign any content types that are not assigned.

  const unassigned = new Set(types);

  for (const assignment of enrichedIndex.assignedContentTypes) {
    let existing = types.find(type => type.contentTypeUri === assignment.contentTypeUri);

    if (!existing) {
      // Need to create a new assignment
      existing = await index.related.assignedContentTypes.create(assignment);
    }

    unassigned.delete(existing);

    // Update any webhooks if they differ from the ones being imported, if the flag is provided.
    // Does the webhook being referenced in the saved index exist in the import?

    //const webhooks = new Map<string, Webhook>();
  }

  // Finally, remove any content type assignments that are not present in the imported index.
  for (const toRemove of unassigned) {
    await toRemove.related.unassign(index.id as string);
  }
};

export const doCreate = async (hub: Hub, index: EnrichedSearchIndex, log: FileLog): Promise<SearchIndex> => {
  try {
    const createdIndex = await hub.related.searchIndexes.create(new SearchIndex(getIndexProperties(index)));

    await enrichIndex(createdIndex, index);

    log.addAction('CREATE', `${createdIndex.id}`);

    return createdIndex;
  } catch (err) {
    throw new Error(`Error creating index ${index.name}:\n\n${err}`);
  }
};

export const doUpdate = async (
  hub: Hub,
  allReplicas: Map<string, SearchIndex[]>,
  index: EnrichedSearchIndex,
  log: FileLog
): Promise<{ index: SearchIndex; updateStatus: UpdateStatus }> => {
  try {
    const retrievedIndex: SearchIndex = await hub.related.searchIndexes.get(index.id || '');
    const webhooks = new Map();

    if (equals(await enrichServerIndex(webhooks, allReplicas, retrievedIndex), index)) {
      return { index: retrievedIndex, updateStatus: UpdateStatus.SKIPPED };
    }

    Object.assign(retrievedIndex, getIndexProperties(index));

    const updatedIndex = await retrievedIndex.related.update(retrievedIndex);

    await enrichIndex(updatedIndex, index);

    log.addAction('UPDATE', `${retrievedIndex.id}`);

    return { index: updatedIndex, updateStatus: UpdateStatus.UPDATED };
  } catch (err) {
    throw new Error(`Error updating index ${index.name}: ${err.message}`);
  }
};

export const processIndices = async (
  indicesToProcess: EnrichedSearchIndex[],
  allReplicas: Map<string, SearchIndex[]>,
  client: DynamicContent,
  hub: Hub,
  log: FileLog
): Promise<void> => {
  const data: string[][] = [];

  data.push([chalk.bold('ID'), chalk.bold('Name'), chalk.bold('Result')]);
  for (const schema of indicesToProcess) {
    let status: ImportResult;
    let index: SearchIndex;
    if (schema.id) {
      const result = await doUpdate(hub, allReplicas, schema, log);
      index = result.index;
      status = result.updateStatus === UpdateStatus.SKIPPED ? 'UP-TO-DATE' : 'UPDATED';
    } else {
      index = await doCreate(hub, schema, log);
      status = 'CREATED';
    }
    data.push([index.id || '', index.name as string, status]);
  }

  log.appendLine(table(data, streamTableOptions));
};

export const handler = async (
  argv: Arguments<ImportBuilderOptions & ConfigurationParameters>,
  idFilter?: string[]
): Promise<void> => {
  const { dir, logFile } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = logFile.open();
  const indices = loadJsonFromDirectory<EnrichedSearchIndex>(dir, EnrichedSearchIndex);
  if (Object.keys(indices).length === 0) {
    throw new Error(`No indices found in ${dir}`);
  }

  validateNoDuplicateIndexNames(indices);

  if (idFilter) {
    filterIndicesById(idFilter, indices);
  }

  const allStoredIndices = await paginator(searchIndexList(hub));
  const { storedIndices, allReplicas } = separateReplicas(allStoredIndices);

  const indicesToProcess = Object.values(indices).map(index => storedIndexMapper(index, storedIndices));

  await processIndices(indicesToProcess, allReplicas, client, hub, log);

  await log.close();
};
