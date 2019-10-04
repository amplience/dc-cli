import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import { extractSortable, SortingOptions, PagingParameters } from '../../common/yargs/sorting-options';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import paginator from '../../common/dc-management-sdk-js/paginator';

export const command = 'list';

export const desc = "List Content Type Schema's";

export const builder: CommandOptions = {
  ...SortingOptions,
  ...RenderingOptions
};

export const itemMapFn = ({ id, schemaId, version, validationLevel }: ContentTypeSchema): object => ({
  id,
  schemaId,
  version,
  validationLevel
});

export const handler = async (
  argv: Arguments<ConfigurationParameters & RenderingArguments & PagingParameters>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const contentTypeSchemaList = await paginator(hub.related.contentTypeSchema.list, extractSortable(argv));

  new DataPresenter(contentTypeSchemaList.map(value => value.toJson())).render({
    json: argv.json,
    itemMapFn: itemMapFn
  });
};
