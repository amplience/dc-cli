import { Arguments } from 'yargs';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { extractSortable, PagingParameters, SortingOptions } from '../../common/yargs/sorting-options';
import { CommandOptions } from '../../interfaces/command-options.interface';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import { LinkedContentRepository } from 'dc-management-sdk-js';

export const command = 'list';

export const desc = 'List Linked Content Repositories';

export const builder: CommandOptions = {
  ...SortingOptions,
  ...RenderingOptions
};

export const itemMapFn = ({ originHubId, originHubLabel, hubIds, bidirectional }: LinkedContentRepository): object => ({
  originHubId,
  originHubLabel,
  hubIds,
  bidirectional
});

export const handler = async (
  argv: Arguments<ConfigurationParameters & RenderingArguments & PagingParameters>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const contentRepositoryList = await paginator(hub.related.linkedContentRepositories.list, extractSortable(argv));

  new DataPresenter(contentRepositoryList.map(value => value.toJSON())).render({
    json: argv.json,
    itemMapFn: itemMapFn
  });
};
