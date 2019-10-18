import { ValidationLevel, ContentTypeSchema } from 'dc-management-sdk-js';

export const updateContentTypeSchema = async (
  schemaToUpdate: ContentTypeSchema,
  schemaBody: string,
  validationLevel: ValidationLevel
): Promise<ContentTypeSchema> => {
  const updatedSchema = new ContentTypeSchema();
  updatedSchema.body = schemaBody;
  updatedSchema.validationLevel = validationLevel;

  return schemaToUpdate.related.update(updatedSchema);
};
