import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';

export const command = 'list';

export const desc = "List Content Type Schema's";

export const builder: CommandOptions = RenderingOptions;

export const handler = async (argv: Arguments<ConfigurationParameters & RenderingArguments>): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  const hub = await client.hubs.get(argv.hubId);
  const contentTypeSchemaList = await hub.related.contentTypeSchema.list();

  new DataPresenter(argv, contentTypeSchemaList)
    .parse(contentTypeSchemaList =>
      contentTypeSchemaList
        .getItems()
        .map(({ id, schemaId, version, validationLevel }) => ({ id, schemaId, version, validationLevel }))
    )
    .render();
};
