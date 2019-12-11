import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { Arguments, Argv } from 'yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import { ValidationLevel } from 'dc-management-sdk-js';
import { jsonResolver } from '../../common/json-resolver/json-resolver';
import { singleItemTableOptions } from '../../common/table/table.consts';
import { updateContentTypeSchema } from './update.service';

export const command = 'update <id>';

export const desc = 'Update Content Type Schema';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Content Type Schema ID',
      type: 'string'
    })
    .options({
      schema: {
        type: 'string',
        demandOption: true,
        description: 'Content Type Schema Source Location',
        requiresArg: true
      },
      validationLevel: {
        type: 'string',
        choices: Object.values(ValidationLevel),
        demandOption: true,
        description: 'Content Type Schema Validation Level',
        requiresArg: true
      },
      ...RenderingOptions
    });
};

export interface BuilderOptions {
  id: string;
  schema: string;
  validationLevel: ValidationLevel;
}

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const { id, schema, validationLevel } = argv;
  const client = dynamicContentClientFactory(argv);
  const schemaBody = await jsonResolver(schema);
  const contentTypeSchema = await client.contentTypeSchemas.get(id);
  const contentTypeSchemaResult = await updateContentTypeSchema(contentTypeSchema, schemaBody, validationLevel);

  new DataPresenter(contentTypeSchemaResult.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
