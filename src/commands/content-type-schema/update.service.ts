import { ValidationLevel, ContentTypeSchema } from 'dc-management-sdk-js';

const validateSchemaBody = (schemaBody: string): void => {
  try {
    JSON.parse(schemaBody);
  } catch (err) {
    throw new Error(`Invalid schema body`);
  }
};

export const updateContentTypeSchema = async (
  schemaToUpdate: ContentTypeSchema,
  schemaBody: string,
  validationLevel: ValidationLevel
): Promise<ContentTypeSchema> => {
  validateSchemaBody(schemaBody);
  const updatedSchema = new ContentTypeSchema();
  updatedSchema.body = schemaBody;
  updatedSchema.validationLevel = validationLevel;

  return schemaToUpdate.related.update(updatedSchema);
};
