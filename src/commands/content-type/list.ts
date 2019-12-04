import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import { extractSortable, SortingOptions, PagingParameters } from '../../common/yargs/sorting-options';
import { ContentType } from 'dc-management-sdk-js';
import paginator from '../../common/dc-management-sdk-js/paginator';

export const command = 'list';

export const desc = "List Content Type's";

export const builder: CommandOptions = {
  ...SortingOptions,
  ...RenderingOptions
};

export const itemMapFn = ({ id, settings, contentTypeUri }: ContentType): object => {
  const label = settings ? settings.label : '';
  return { ID: id, Label: label, 'Schema ID': contentTypeUri };
};

export const handler = async (
  argv: Arguments<ConfigurationParameters & RenderingArguments & PagingParameters>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const contentTypeList = await paginator(hub.related.contentTypes.list, extractSortable(argv));

  new DataPresenter(contentTypeList.map(value => value.toJSON())).render({
    json: argv.json,
    itemMapFn: itemMapFn
  });
};
