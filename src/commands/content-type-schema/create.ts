import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { Arguments } from 'yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../configure';
import * as fs from 'fs';
import { ContentTypeSchema, ValidationLevel } from 'dc-management-sdk-js';
import { URL } from 'url';
import axios from 'axios';
import { singleItemTableOptions } from '../../common/table/table.consts';

export const command = 'create';

export const desc = 'Create Content Type Schema';

export const builder: CommandOptions = {
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
  schema: string;
  validationLevel: string;
}

async function getSchemaBody(schema: string): Promise<string> {
  if (schema.match(/^(http|https):\/\//)) {
    const result = await axios.get(schema);
    if (typeof result.data == 'string') {
      return result.data;
    }

    return JSON.stringify(result.data);
  }

  const path = schema.match(/file:\/\//) ? new URL(schema) : schema;
  const schemaBody = fs.readFileSync(path, 'utf-8');
  return schemaBody;
}

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const schemaBody = await getSchemaBody(argv.schema);
  const schemaJson = JSON.parse(schemaBody);
  if (schemaJson.id == undefined) {
    throw new Error('Missing id from schema');
  }

  const contentTypeSchema = new ContentTypeSchema();
  contentTypeSchema.body = schemaBody;
  contentTypeSchema.schemaId = schemaJson.id;
  contentTypeSchema.validationLevel = argv.validationLevel as ValidationLevel;

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const contentTypeSchemaResult = await hub.related.contentTypeSchema.create(contentTypeSchema);

  return new DataPresenter(contentTypeSchemaResult.toJson()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
