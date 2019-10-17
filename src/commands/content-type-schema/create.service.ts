import { ContentTypeSchema, Hub, ValidationLevel } from 'dc-management-sdk-js';

export const createContentTypeSchema = async (
  schemaBody: string,
  validationLevel: ValidationLevel,
  hub: Hub
): Promise<ContentTypeSchema> => {
  const schemaJson = JSON.parse(schemaBody);
  if (!schemaJson.id) {
    throw new Error('Missing id from schema');
  }
  const contentTypeSchema = new ContentTypeSchema();
  contentTypeSchema.body = schemaBody;
  contentTypeSchema.schemaId = schemaJson.id;
  contentTypeSchema.validationLevel = validationLevel;
  console.log('createContentTypeSchema end');

  return hub.related.contentTypeSchema.create(contentTypeSchema);
};
