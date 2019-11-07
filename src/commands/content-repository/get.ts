import { Argv, Arguments } from 'yargs';
import DataPresenter, { RenderingOptions, RenderingArguments } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentRepository } from 'dc-management-sdk-js';
import { singleItemTableOptions } from '../../common/table/table.consts';

export const command = 'get <id>';

export const desc = 'Get Content Repository';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Content Repository ID',
      type: 'string'
    })
    .options(RenderingOptions);
};

export interface BuilderOptions {
  id: string;
}

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  const contentRepository: ContentRepository = await client.contentRepositories.get(argv.id);
  new DataPresenter(contentRepository.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
