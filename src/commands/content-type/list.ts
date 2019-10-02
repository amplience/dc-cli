import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { PreRenderedData, RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import { ContentType, Page } from 'dc-management-sdk-js';
import { extractPageableSortable, PagingOptions, PagingParameters } from '../../common/yargs/paging-options';

export const command = 'list';

export const desc = "List Content Type's";

export const builder: CommandOptions = {
  ...PagingOptions,
  ...RenderingOptions
};

export const parseDataPresenter = (contentTypeSchemaList: Page<ContentType>): PreRenderedData[] =>
  contentTypeSchemaList.getItems().map(({ id, contentTypeUri, settings }) => {
    const label = settings !== undefined ? settings.label : '';
    return { id, label, contentTypeUri };
  });

export const handler = async (
  argv: Arguments<ConfigurationParameters & RenderingArguments & PagingParameters>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const contentTypeSchemaList = await hub.related.contentTypes.list(extractPageableSortable(argv));

  new DataPresenter(argv, contentTypeSchemaList).parse(parseDataPresenter).render();
};
