import { ContentTypeSchema } from 'dc-management-sdk-js';
import { jsonResolver } from '../common/json-resolver/json-resolver';
import resolveSchemaId from '../common/json-schema/resolve-schema-id';

type ResolveSchemaBodyErrors = { [p: string]: Error };
type ContentTypeSchemaFiles = { [p: string]: ContentTypeSchema };

export const resolveSchemaBody = async (
  schemas: ContentTypeSchemaFiles,
  dir: string
): Promise<[ContentTypeSchemaFiles, ResolveSchemaBodyErrors]> => {
  const errors: ResolveSchemaBodyErrors = {};
  const resolved: ContentTypeSchemaFiles = {};
  for (const [filename, contentTypeSchema] of Object.entries(schemas)) {
    if (contentTypeSchema.body) {
      try {
        contentTypeSchema.body = await jsonResolver(contentTypeSchema.body, dir);
        if (!contentTypeSchema.schemaId) {
          const parsedBody = JSON.parse(contentTypeSchema.body);
          const schemaId = resolveSchemaId(parsedBody);
          if (schemaId) {
            contentTypeSchema.schemaId = schemaId;
          }
        }
      } catch (err) {
        errors[filename] = err;
      }
    }
    resolved[filename] = contentTypeSchema;
  }
  return [resolved, errors];
};
