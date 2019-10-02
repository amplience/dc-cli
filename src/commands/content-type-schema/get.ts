import * as yargs from 'yargs';
import { Arguments } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../configure';

export const command = 'get';

export const desc = 'Get Content Type Schema';

export const builder = (yargs: yargs.Argv): void => {
  yargs
    .positional('id', {
      describe: 'content-type-schema ID',
      type: 'string'
    })
    .options({
      id: {
        type: 'string',
        demandOption: true,
        description: 'content-type-schema ID'
      },
      ...RenderingOptions
    });
};

interface BuilderOptions {
  id: string;
}

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  const contentTypeSchema: ContentTypeSchema = await client.contentTypeSchemas.get(argv.id);
  const tableOptions = {
    columns: {
      1: {
        width: 100
      }
    }
  };

  new DataPresenter(argv, contentTypeSchema, tableOptions).render();
};
