import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { Arguments, Argv } from 'yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import { ContentTypeSchema, ValidationLevel } from 'dc-management-sdk-js';
import { getSchemaBody } from './helper/content-type-schema.helper';
import { singleItemTableOptions } from '../../common/table/table.consts';

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
        description: 'Content Type Schema Source Location'
      },
      validationLevel: {
        type: 'string',
        choices: Object.values(ValidationLevel),
        demandOption: true,
        description: 'Content Type Schema Validation Level'
      },
      ...RenderingOptions
    });
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

  new DataPresenter(contentTypeSchemaResult.toJson()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
