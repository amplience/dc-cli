import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { Arguments } from 'yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import { ValidationLevel, ContentTypeSchema } from 'dc-management-sdk-js';
import { getSchemaBody } from './helper/content-type-schema.helper';

export const command = 'update';

export const desc = 'Update Content Type Schema';

export const builder: CommandOptions = {
  id: {
    type: 'string',
    demandOption: true,
    description: 'content-type-schema ID'
  },
  schema: {
    type: 'string',
    demandOption: true,
    description: 'content-type-schema Source Location'
  },
  validationLevel: {
    type: 'string',
    choices: Object.values(ValidationLevel),
    demandOption: true,
    description: 'content-type-schema Validation Level'
  },
  ...RenderingOptions
};

export interface BuilderOptions {
  id: string;
  schema: string;
  validationLevel: string;
}

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const schemaBody = await getSchemaBody(argv.schema);
  const schemaJson = JSON.parse(schemaBody);
  if (schemaJson.id == undefined) {
    throw new Error('Missing id from schema');
  }

  const client = dynamicContentClientFactory(argv);

  const updatedSchema = new ContentTypeSchema();
  updatedSchema.body = schemaBody;
  updatedSchema.validationLevel = argv.validationLevel as ValidationLevel;

  const contentTypeSchema = await client.contentTypeSchemas.get(argv.id);
  const contentTypeSchemaResult = await contentTypeSchema.related.update(updatedSchema);

  return new DataPresenter(argv, contentTypeSchemaResult, {
    columns: {
      1: {
        width: 100
      }
    }
  }).render();
};
