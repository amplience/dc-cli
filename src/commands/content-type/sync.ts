import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType, ContentTypeCachedSchema } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../configure';
import BuilderOptions from '../../interfaces/builder-options';
import { singleItemTableOptions } from '../../common/table/table.consts';

export const command = 'sync <id>';

export const desc = 'Sync Content Type with the schema';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Content Type ID',
      type: 'string'
    })
    .options(RenderingOptions);
};

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  const contentType: ContentType = await client.contentTypes.get(argv.id);
  const contentTypeCachedSchema: ContentTypeCachedSchema = await contentType.related.contentTypeSchema.update();
  new DataPresenter(contentTypeCachedSchema.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
