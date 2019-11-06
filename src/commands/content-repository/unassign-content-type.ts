import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { Arguments, Argv } from 'yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import { singleItemTableOptions } from '../../common/table/table.consts';

export const command = 'unassign-content-type <id>';

export const desc = 'Unassign Content Type';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Content Repository ID',
      type: 'string'
    })
    .options({
      contentTypeId: {
        type: 'string',
        demandOption: true,
        description: 'content-type ID to unassign',
        requiresArg: true
      },
      ...RenderingOptions
    });
};

export interface BuilderOptions {
  id: string;
  contentTypeId: string;
}

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  const contentRepository = await client.contentRepositories.get(argv.id);
  await contentRepository.related.contentTypes.unassign(argv.contentTypeId);
  const contentRepositoryUpdated = await client.contentRepositories.get(argv.id);

  return new DataPresenter(contentRepositoryUpdated.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
