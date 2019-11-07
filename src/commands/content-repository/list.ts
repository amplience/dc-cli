import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import { extractSortable, PagingParameters, SortingOptions } from '../../common/yargs/sorting-options';
import { ContentRepository, ContentRepositoryContentType } from 'dc-management-sdk-js';
import paginator from '../../common/dc-management-sdk-js/paginator';

export const command = 'list';

export const desc = 'List Content Repositories';

export const builder: CommandOptions = {
  ...SortingOptions,
  ...RenderingOptions
};

export const itemMapFn = ({
  id,
  name,
  label,
  status,
  features,
  contentTypes,
  itemLocales
}: ContentRepository): object => ({
  id,
  name,
  label,
  status,
  features: (features || []).join(', '),
  contentTypes: (contentTypes || [])
    .map((contentType: ContentRepositoryContentType) =>
      [contentType.hubContentTypeId, contentType.contentTypeUri].join(', ')
    )
    .join('\n'),
  itemLocales
});

export const handler = async (
  argv: Arguments<ConfigurationParameters & RenderingArguments & PagingParameters>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const contentRepositoryList = await paginator(hub.related.contentRepositories.list, extractSortable(argv));

  new DataPresenter(contentRepositoryList.map(value => value.toJSON())).render({
    json: argv.json,
    itemMapFn: itemMapFn
  });
};
