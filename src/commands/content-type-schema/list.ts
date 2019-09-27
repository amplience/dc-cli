import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import { GlobalConfigurationParameters } from '../../configuration/command-line-parser.service';
import { DynamicContent } from 'dc-management-sdk-js';
import { renderData, RenderingArguments, RenderingOptions } from '../../view/data-presenter';

export const command = 'list';

export const desc = 'Get Content Type Schema';

export const builder: CommandOptions = RenderingOptions;

interface BuilderOptions {
  id: string;
}

export const handler = async (
  argv: Arguments<BuilderOptions & GlobalConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = new DynamicContent(
    {
      // eslint-disable-next-line @typescript-eslint/camelcase
      client_id: argv.key,
      // eslint-disable-next-line @typescript-eslint/camelcase
      client_secret: argv.secret
    },
    {
      apiUrl: process.env.API_URL,
      authUrl: process.env.AUTH_URL
    }
  );

  const hub = await client.hubs.get(argv.hub);
  const contentTypeSchemaList = await hub.related.contentTypeSchema.list();
  const listItems = contentTypeSchemaList
    .getItems()
    .map(({ id, schemaId, version, validationLevel }) => ({ id, schemaId, version, validationLevel }));

  renderData(argv, listItems);
};
