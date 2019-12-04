import { ContentTypeSchema } from 'dc-management-sdk-js';
import { jsonResolver } from '../common/json-resolver/json-resolver';

type ResolveSchemaBodyErrors = { [p: string]: Error };
type ContentTypeSchemaFiles = { [p: string]: ContentTypeSchema };

export const resolveSchemaBody = async (
  schemas: ContentTypeSchemaFiles,
  dir: string
): Promise<[ContentTypeSchemaFiles, ResolveSchemaBodyErrors]> => {
  const errors: ResolveSchemaBodyErrors = {};
  for (const [key, schema] of Object.entries(schemas)) {
    if (schema.body) {
      try {
        schema.body = await jsonResolver(schema.body, dir);
      } catch (err) {
        errors[key] = err;
      }
    }
  }
  return [schemas, errors];
};
