import chalk from 'chalk';
import { Hub, Page, Pageable, SearchIndex, Settings, Sortable, Webhook } from 'dc-management-sdk-js';
import { join } from 'path';
import { table } from 'table';
import { Arguments, Argv } from 'yargs';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { FileLog } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { streamTableOptions } from '../../common/table/table.consts';
import { ImportIndexBuilderOptions } from '../../interfaces/import-index-builder-options.interface';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ImportResult, loadJsonFromDirectory, UpdateStatus } from '../../services/import.service';
import { ConfigurationParameters } from '../configure';
import { EnrichedSearchIndex, equals, enrichIndex as enrichServerIndex, separateReplicas } from './export';
import { rewriteDeliveryContentItem } from './webhook-rewriter';

export const command = 'import <dir>';

export const desc = 'Import Search Index';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('search-index', 'import', platform);

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Directory containing Search Indexes',
    type: 'string'
  });

  yargs.option('logFile', {
    type: 'string',
    default: LOG_FILENAME,
    describe: 'Path to a log file to write to.',
    coerce: createLog
  });

  yargs.option('webhooks', {
    type: 'boolean',
    describe:
      'Import webhooks as well. The command will attempt to rewrite account names and staging environments in the webhook body to match the destination.',
    boolean: true
  });
};

const searchIndexList = (hub: Hub, parentId?: string, projection?: string) => {
  return (options?: Pageable & Sortable): Promise<Page<SearchIndex>> =>
    hub.related.searchIndexes.list(parentId, projection, options);
};

export const replicaList = (index: SearchIndex, projection?: string) => {
  return (options?: Pageable & Sortable): Promise<Page<SearchIndex>> =>
    index.related.replicas.list(projection, options);
};

type IndexName = string;
type IndexFile = string;

export const validateNoDuplicateIndexNames = (importedIndexes: {
  [filename: string]: EnrichedSearchIndex;
}): void | never => {
  const nameToFilenameMap = new Map<IndexName, IndexFile[]>(); // map: name x filenames
  for (const [filename, index] of Object.entries(importedIndexes)) {
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
      `Indexes must have unique name values. Duplicate values found:-\n${uniqueDuplicateNames
        .map(([name, filenames]) => `  name: '${name}' in files: [${filenames.map(f => `'${f}'`).join(', ')}]`)
        .join('\n')}`
    );
  }
};

export const rewriteIndexNames = (
  hub: Hub,
  importedIndexes: {
    [filename: string]: EnrichedSearchIndex;
  }
): void | never => {
  for (const index of Object.values(importedIndexes)) {
    const name = index.name as string;
    const firstDot = name.indexOf('.');

    if (firstDot == -1) {
      index.name = `${hub.name}.${name}`;
    } else {
      index.name = `${hub.name}${name.substring(firstDot)}`;
    }
  }
};

export const filterIndexesById = (
  idFilter: string[],
  importedIndexes: {
    [filename: string]: SearchIndex;
  }
): void | never => {
  for (const [filename, index] of Object.entries(importedIndexes)) {
    if (idFilter.indexOf(index.id as string) === -1) {
      delete importedIndexes[filename];
    }
  }
};

export const storedIndexMapper = (index: EnrichedSearchIndex, storedIndexes: SearchIndex[]): EnrichedSearchIndex => {
  const found = storedIndexes.find(stored => stored.name === index.name);
  const mutatedIndex = found ? { ...index, id: found.id } : index;

  return new EnrichedSearchIndex(mutatedIndex);
};

export const getIndexProperties = (index: SearchIndex): object => {
  return {
    label: index.label,
    name: index.name,
    suffix: index.suffix,
    type: index.type
  };
};

export const updateWebhookIfDifferent = async (webhook: Webhook, newWebhook: Webhook | undefined): Promise<void> => {
  if (newWebhook === undefined) {
    return;
  }

  await webhook.related.update(newWebhook);
};

export const enrichIndex = async (
  index: SearchIndex,
  enrichedIndex: EnrichedSearchIndex,
  webhooks: Map<string, Webhook> | undefined
): Promise<void> => {
  // Union the replicas on the server and the replicas being imported.
  // This avoids replicas being detached from their parents, and thus becoming unusable.
  const settings = await index.related.settings.get();
  const replicas = new Set<string>(settings.replicas || []);
  if (enrichedIndex.settings.replicas) {
    enrichedIndex.settings.replicas.forEach((replica: string) => {
      replicas.add(replica);
    });
  }
  enrichedIndex.settings.replicas = Array.from(replicas);

  // Update the search index settings.
  await index.related.settings.update(enrichedIndex.settings, false);

  if (replicas.size) {
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

    if (webhooks) {
      await updateWebhookIfDifferent(await existing.related.webhook(), webhooks.get(assignment.webhook));
      await updateWebhookIfDifferent(
        await existing.related.activeContentWebhook(),
        webhooks.get(assignment.activeContentWebhook)
      );
      await updateWebhookIfDifferent(
        await existing.related.archivedContentWebhook(),
        webhooks.get(assignment.archivedContentWebhook)
      );
    }
  }

  // Finally, remove any content type assignments that are not present in the imported index.
  for (const toRemove of unassigned) {
    await toRemove.related.unassign(index.id as string);
  }
};

export const doCreate = async (
  hub: Hub,
  index: EnrichedSearchIndex,
  webhooks: Map<string, Webhook> | undefined,
  log: FileLog
): Promise<SearchIndex> => {
  try {
    const assignedContentTypes = index.assignedContentTypes.map(type => ({ contentTypeUri: type.contentTypeUri }));

    const toCreate = new SearchIndex({ ...getIndexProperties(index), assignedContentTypes });

    const createdIndex = await hub.related.searchIndexes.create(toCreate);

    await enrichIndex(createdIndex, index, webhooks);

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
  webhooks: Map<string, Webhook> | undefined,
  log: FileLog
): Promise<{ index: SearchIndex; updateStatus: UpdateStatus }> => {
  try {
    const retrievedIndex: SearchIndex = await hub.related.searchIndexes.get(index.id as string);

    const dstWebhooks = new Map<string, Webhook>();

    const enrichedWebhook = await enrichServerIndex(dstWebhooks, allReplicas, retrievedIndex);

    if (equals(enrichedWebhook, index, false, dstWebhooks, webhooks)) {
      return { index: retrievedIndex, updateStatus: UpdateStatus.SKIPPED };
    }

    Object.assign(retrievedIndex, getIndexProperties(index));

    const updatedIndex = await retrievedIndex.related.update(retrievedIndex);

    await enrichIndex(updatedIndex, index, webhooks);

    log.addAction('UPDATE', `${retrievedIndex.id}`);

    return { index: updatedIndex, updateStatus: UpdateStatus.UPDATED };
  } catch (err) {
    throw new Error(`Error updating index ${index.name}: ${err.message}`);
  }
};

export const loadAndRewriteWebhooks = async (hub: Hub, dir: string): Promise<Map<string, Webhook>> => {
  const webhookList = loadJsonFromDirectory<Webhook>(dir, Webhook);
  const webhooks = new Map<string, Webhook>();

  for (const webhook of Object.values(webhookList)) {
    webhooks.set(webhook.id as string, webhook);
  }

  // Rewrite webhooks. Load VSE and account name from settings.
  const account = hub.name as string;
  const settings = hub.settings as Settings;
  const vseObj = settings.virtualStagingEnvironment;
  const vse = vseObj ? vseObj.hostname : undefined;

  webhooks.forEach(webhook => {
    if (webhook.customPayload) {
      webhook.customPayload.value = rewriteDeliveryContentItem(webhook.customPayload.value, account, vse);
    }
  });

  return webhooks;
};

export const processIndexes = async (
  indexesToProcess: EnrichedSearchIndex[],
  allReplicas: Map<string, SearchIndex[]>,
  webhooks: Map<string, Webhook> | undefined,
  hub: Hub,
  log: FileLog
): Promise<void> => {
  const data: string[][] = [];

  data.push([chalk.bold('ID'), chalk.bold('Name'), chalk.bold('Result')]);
  for (const entry of indexesToProcess) {
    let status: ImportResult;
    let index: SearchIndex;
    if (entry.id) {
      const result = await doUpdate(hub, allReplicas, entry, webhooks, log);
      index = result.index;
      status = result.updateStatus === UpdateStatus.SKIPPED ? 'UP-TO-DATE' : 'UPDATED';
    } else {
      index = await doCreate(hub, entry, webhooks, log);
      status = 'CREATED';
    }
    data.push([index.id as string, index.name as string, status]);
  }

  log.appendLine(table(data, streamTableOptions));
};

export const handler = async (
  argv: Arguments<ImportIndexBuilderOptions & ConfigurationParameters>,
  idFilter?: string[]
): Promise<void> => {
  const { dir, logFile } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const log = logFile.open();
  const indexes = loadJsonFromDirectory<EnrichedSearchIndex>(dir, EnrichedSearchIndex);
  if (Object.keys(indexes).length === 0) {
    throw new Error(`No indexes found in ${dir}`);
  }

  validateNoDuplicateIndexNames(indexes);
  rewriteIndexNames(hub, indexes);

  if (idFilter) {
    filterIndexesById(idFilter, indexes);
  }

  const allStoredIndexes = await paginator(searchIndexList(hub));
  const { storedIndexes, allReplicas } = separateReplicas(allStoredIndexes);

  const indexesToProcess = Object.values(indexes).map(index => storedIndexMapper(index, storedIndexes));
  const webhooks = argv.webhooks ? await loadAndRewriteWebhooks(hub, join(dir, 'webhooks')) : undefined;

  await processIndexes(indexesToProcess, allReplicas, webhooks, hub, log);

  await log.close();
};
