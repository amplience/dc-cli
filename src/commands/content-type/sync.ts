import { Arguments, Argv } from 'yargs';
import DataPresenter, { PreRenderedData, RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../configure';
import BuilderOptions from '../../interfaces/builder-options';

interface CachedSchema {
  $schema: string;
  id: string;
  [key: string]: unknown;
}

export interface ContentTypeCachedSchema {
  hubId?: string;
  contentTypeUri?: string;
  cachedSchema?: CachedSchema;
  toJSON: () => PreRenderedData;
}

export const command = 'sync [id]';

export const desc = 'Sync Content Type with the schema';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'content-type ID',
      type: 'string',
      demandOption: true
    })
    .options(RenderingOptions);
};

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  const tableOptions = {
    columns: {
      1: {
        width: 100
      }
    }
  };
  const contentType: ContentType = await client.contentTypes.get(argv.id);
  const contentTypeCachedSchema: ContentTypeCachedSchema = await contentType.related.contentTypeSchema.update();
  new DataPresenter(argv, contentTypeCachedSchema, tableOptions).render();
};
