import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import { extractPageableSortable, PagingOptions, PagingParameters } from '../../common/yargs/paging-options';
import { ContentType } from 'dc-management-sdk-js';

export const command = 'list';

export const desc = "List Content Type's";

export const builder: CommandOptions = {
  ...PagingOptions,
  ...RenderingOptions
};

export const itemMapFn = ({ id, settings, contentTypeUri }: ContentType): object => {
  const label = settings ? settings.label : '';
  return { id, label, contentTypeUri: contentTypeUri };
};

export const handler = async (
  argv: Arguments<ConfigurationParameters & RenderingArguments & PagingParameters>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const contentTypeSchemaList = await hub.related.contentTypes.list(extractPageableSortable(argv));

  new DataPresenter(contentTypeSchemaList.getItems().map(v => v.toJSON())).render({
    itemMapFn: itemMapFn
  });
};
