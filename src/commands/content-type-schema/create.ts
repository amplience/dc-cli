import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { Arguments } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ValidationLevel } from 'dc-management-sdk-js';
import { singleItemTableOptions } from '../../common/table/table.consts';
import { createContentTypeSchema } from './create.service';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { jsonResolver } from '../../common/json-resolver/json-resolver';

export const command = 'create';

export const desc = 'Create Content Type Schema';

export const builder: CommandOptions = {
  schema: {
    type: 'string',
    demandOption: true,
    description: 'content-type-schema Source Location',
    requiresArg: true
  },
  validationLevel: {
    type: 'string',
    choices: Object.values(ValidationLevel),
    demandOption: true,
    description: 'content-type-schema Validation Level',
    requiresArg: true
  },
  ...RenderingOptions
};

export interface BuilderOptions {
  schema: string;
  validationLevel: string;
}

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const schemaBody = await jsonResolver(argv.schema);
  const contentTypeSchemaResult = await createContentTypeSchema(
    schemaBody,
    argv.validationLevel as ValidationLevel,
    hub
  );

  return new DataPresenter(contentTypeSchemaResult.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
