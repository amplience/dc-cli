import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { jsonResolver } from '../../common/json-resolver/json-resolver';
import { LinkedContentRepository } from 'dc-management-sdk-js';
import { singleItemTableOptions } from '../../common/table/table.consts';

export const command = 'update';

export const desc = 'Update Linked Content Repository';

export const builder = (yargs: Argv): void => {
  yargs.options({
    file: {
      type: 'string',
      demandOption: true,
      description: 'Linked Content Repository json file location',
      requiresArg: true
    },
    ...RenderingOptions
  });
};

export interface BuilderOptions {
  file: string;
}

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const { file } = argv;
  const client = dynamicContentClientFactory(argv);
  const json = await jsonResolver(file);
  const hub = await client.hubs.get(argv.hubId);
  const linkedContentRepository = await hub.related.linkedContentRepositories.update(
    new LinkedContentRepository(JSON.parse(json))
  );

  new DataPresenter(linkedContentRepository.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
