import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import paginator from '../../common/dc-management-sdk-js/paginator';

export const command = 'list';

export const desc = 'List Content Type Schemas';

export const builder: CommandOptions = {
  ...RenderingOptions
};

export const itemMapFn = ({ id, schemaId, version, validationLevel }: ContentTypeSchema): object => ({
  ID: id,
  'Schema ID': schemaId,
  Version: version,
  'Validation Level': validationLevel
});

export const handler = async (argv: Arguments<ConfigurationParameters & RenderingArguments>): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const contentTypeSchemaList = await paginator(hub.related.contentTypeSchema.list);

  if (contentTypeSchemaList.length > 0) {
    new DataPresenter(contentTypeSchemaList.map(value => value.toJSON())).render({
      json: argv.json,
      itemMapFn: itemMapFn
    });
  } else {
    console.log('There are no content type schemas defined.');
  }
};
