import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import { Pageable, Sortable } from 'dc-management-sdk-js';

export const command = 'list';

export const desc = "List Content Type Schema's";

export const builder: CommandOptions = {
  page: {
    type: 'number',
    description: 'page number to retrieve'
  },
  size: {
    type: 'number',
    description: 'number of items per page'
  },
  sort: {
    type: 'string',
    description: 'how to order the list e.g createdDate,asc'
  },
  ...RenderingOptions
};

const getPagingOptions = (argv: Arguments<ConfigurationParameters & RenderingArguments>): Pageable & Sortable => {
  const { page, sort, size } = argv;
  return {
    ...(page ? { page } : {}),
    ...(sort ? { sort } : {}),
    ...(size ? { size } : {})
  } as Pageable & Sortable;
};

export const handler = async (argv: Arguments<ConfigurationParameters & RenderingArguments>): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const pagingOptions = getPagingOptions(argv);

  const hub = await client.hubs.get(argv.hubId);
  const contentTypeSchemaList = await hub.related.contentTypeSchema.list(pagingOptions);

  new DataPresenter(argv, contentTypeSchemaList)
    .parse(contentTypeSchemaList =>
      contentTypeSchemaList
        .getItems()
        .map(({ id, schemaId, version, validationLevel }) => ({ id, schemaId, version, validationLevel }))
    )
    .render();
};
