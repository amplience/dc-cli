import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from './configure';
import dynamicContentClientFactory from '../services/dynamic-content-client-factory';
import { FileLog } from '../common/file-log';
import { WorkflowItemBuilderOptions } from '../interfaces/workflow-item-builder-options.interface';
import paginator from '../common/dc-management-sdk-js/paginator';
import { ContentItem, DynamicContent, Hub, WorkflowState } from 'dc-management-sdk-js';
import { getDefaultLogPath } from '../common/log-helpers';
import { applyFacet, withOldFilters } from '../common/filter/facet';

export const command = 'workflow';

export const desc = 'Change workflow of Content Items';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('item', 'workflow', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .option('repoId', {
      type: 'string',
      describe:
        'Change workflow of content from within a given repository. Directory structure will start at the specified repository'
    })
    .option('facet', {
      type: 'string',
      describe:
        "Change workflow of content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
    })
    .option('targetWorkflowLabel', {
      type: 'string',
      describe: 'Target Workflow Label'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.'
    })
    .option('name', {
      type: 'string',
      hidden: true
    })
    .option('schemaId', {
      type: 'string',
      hidden: true
    });
};

const getContentItems = async (
  client: DynamicContent,
  hub: Hub,
  log: FileLog,
  repoId?: string | string[]
): Promise<ContentItem[]> => {
  const items: ContentItem[] = [];

  const repoIds = typeof repoId === 'string' ? [repoId] : repoId || [];

  const repositories = await (repoId != null
    ? Promise.all(repoIds.map(id => client.contentRepositories.get(id)))
    : paginator(hub.related.contentRepositories.list));

  for (let i = 0; i < repositories.length; i++) {
    const repository = repositories[i];

    try {
      const allItems = await paginator(repository.related.contentItems.list, { status: 'ACTIVE' });

      Array.prototype.push.apply(items, allItems);
    } catch (e) {
      log.warn(`Could not get items from repository ${repository.name} (${repository.id})`, e);
      continue;
    }
  }

  return items;
};

export const handler = async (argv: Arguments<WorkflowItemBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { repoId, logFile, targetWorkflowLabel } = argv;

  const facet = withOldFilters(argv.facet, argv);

  const client = dynamicContentClientFactory(argv);
  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;
  const hub = await client.hubs.get(argv.hubId);

  log.appendLine('Retrieving content items, please wait.');
  let items: ContentItem[] = await getContentItems(client, hub, log, repoId);

  const targetStates: WorkflowState[] = await paginator(hub.related.workflowStates.list);
  const targetState: WorkflowState | undefined = targetStates.find(i => i.label === targetWorkflowLabel);
  //Filter using the facet, if present.
  if (facet) {
    items = applyFacet(items, facet);
  }

  if (targetState) {
    log.appendLine(`Target workflow state: ${targetState.label}, id ${targetState.id}`);
    items.forEach(async item => {
      const updateContentItem: ContentItem = await item.related.update(
        new ContentItem({
          workflow: {
            state: targetState.id
          },
          version: item.version
        })
      );
      log.appendLine(
        `Updating workflow state of ${item.label}, ${item.locale}, ${item.version} to '${targetState.label}'`
      );
      log.appendLine(JSON.stringify(updateContentItem));
    });
  } else {
    log.appendLine(`Workflow not found ${argv.targetWorkflowLabel} - please check spelling`);
  }

  await log.close();
};
