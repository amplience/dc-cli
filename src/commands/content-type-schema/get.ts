import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../configure';
import BuilderOptions from '../../interfaces/builder-options';
import { singleItemTableOptions } from '../../common/table/table.consts';

export const command = 'get <id>';

export const desc = 'Get Content Type Schema by ID';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Content Type Schema ID',
      type: 'string'
    })
    .options(RenderingOptions);
};

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  const contentTypeSchema: ContentTypeSchema = await client.contentTypeSchemas.get(argv.id);
  new DataPresenter(contentTypeSchema.toJSON()).render({ json: argv.json, tableUserConfig: singleItemTableOptions });
};
