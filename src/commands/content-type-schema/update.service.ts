import { ValidationLevel, ContentTypeSchema } from 'dc-management-sdk-js';

export const updateContentTypeSchema = async (
  schemaToUpdate: ContentTypeSchema,
  schemaBody: string,
  validationLevel: ValidationLevel
): Promise<ContentTypeSchema> => {
  const schemaJson = JSON.parse(schemaBody);
  if (!schemaJson.id) {
    throw new Error('Missing id from schema');
  }

  const updatedSchema = new ContentTypeSchema();
  updatedSchema.body = schemaBody;
  updatedSchema.validationLevel = validationLevel;

  return schemaToUpdate.related.update(updatedSchema);
};
