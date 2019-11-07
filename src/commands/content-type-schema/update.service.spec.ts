import { ValidationLevel, ContentTypeSchema } from 'dc-management-sdk-js';
import { updateContentTypeSchema } from './update.service';

describe('update.service', () => {
  describe('updateContentTypeSchema', () => {
    it('should update schema', async () => {
      const schemaBody = { id: 'http://example.com/schema.json', title: 'original' };
      const schemaToUpdate = new ContentTypeSchema({
        body: JSON.stringify(schemaBody),
        validationLevel: ValidationLevel.CONTENT_TYPE
      });
      const mutatedSchemaBody = { ...schemaBody, title: 'updated' };
      const mutatedContentTypeSchema = {
        body: JSON.stringify(mutatedSchemaBody),
        validationLevel: ValidationLevel.CONTENT_TYPE
      };
      const mockUpdate = jest.fn().mockResolvedValue(mutatedContentTypeSchema);
      schemaToUpdate.related.update = mockUpdate;
      const result = await updateContentTypeSchema(
        schemaToUpdate,
        JSON.stringify(mutatedSchemaBody),
        ValidationLevel.CONTENT_TYPE
      );

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentTypeSchema));
      expect(result).toEqual(expect.objectContaining(mutatedContentTypeSchema));
    });
  });
});
