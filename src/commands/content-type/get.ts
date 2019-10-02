import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../configure';
import GetBuilderOptions from '../../interfaces/get-builder-options';

export const command = 'get [id]';

export const desc = 'Get Content Type';

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
  argv: Arguments<GetBuilderOptions & ConfigurationParameters & RenderingArguments>
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
  new DataPresenter(argv, contentType, tableOptions).render();
};
