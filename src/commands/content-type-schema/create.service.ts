import { ContentTypeSchema, Hub, ValidationLevel } from 'dc-management-sdk-js';
import resolveSchemaId from '../../common/json-schema/resolve-schema-id';

export const createContentTypeSchema = async (
  schemaBody: string,
  validationLevel: ValidationLevel,
  hub: Hub
): Promise<ContentTypeSchema> => {
  let schemaJson;
  try {
    schemaJson = JSON.parse(schemaBody);
  } catch (err) {
    throw new Error('Unable to parse schema body');
  }
  const schemaId = resolveSchemaId(schemaJson);
  if (!schemaId) {
    throw new Error('Missing id from schema');
  }
  const contentTypeSchema = new ContentTypeSchema();
  contentTypeSchema.body = schemaBody;
  contentTypeSchema.schemaId = schemaId;
  contentTypeSchema.validationLevel = validationLevel;

  return hub.related.contentTypeSchema.create(contentTypeSchema);
};
