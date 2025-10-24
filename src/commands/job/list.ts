import { Arguments } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { extractSortable, PagingParameters } from '../../common/yargs/sorting-options';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { Job } from 'dc-management-sdk-js';
import { CommandOptions } from '../../interfaces/command-options.interface';

export const command = 'list';

export const desc = 'List jobs';

export const builder: CommandOptions = {
  ...RenderingOptions
};

export const itemMapFn = ({ id, label, status, jobType, originHubId, destinationHubId }: Job): object => ({
  id,
  label,
  status,
  jobType,
  originHubId,
  destinationHubId
});

export const handler = async (
  argv: Arguments<ConfigurationParameters & RenderingArguments & PagingParameters>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const contentTypeList = await paginator(hub.related.jobs.list, extractSortable(argv));

  new DataPresenter(contentTypeList.map(value => value.toJSON())).render({
    json: argv.json,
    itemMapFn: itemMapFn
  });
};
