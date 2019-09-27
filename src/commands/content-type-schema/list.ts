import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import { GlobalConfigurationParameters } from '../../configuration/command-line-parser.service';
import { renderData, RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';

export const command = 'list';

export const desc = 'Get Content Type Schema';

export const builder: CommandOptions = RenderingOptions;

interface BuilderOptions {
  id: string;
}

export const handler = async (
  argv: Arguments<BuilderOptions & GlobalConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  const hub = await client.hubs.get(argv.hub);
  const contentTypeSchemaList = await hub.related.contentTypeSchema.list();
  const listItems = contentTypeSchemaList
    .getItems()
    .map(({ id, schemaId, version, validationLevel }) => ({ id, schemaId, version, validationLevel }));

  renderData(argv, listItems);
};
