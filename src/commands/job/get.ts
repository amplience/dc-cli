import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { singleItemTableOptions } from '../../common/table/table.consts';

export const command = 'get <id>';

export const desc = 'Get a Job by ID';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Job ID',
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
  const hub = await client.hubs.get(argv.hubId);
  const job = await hub.related.jobs.get(argv.id);

  new DataPresenter(job.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
