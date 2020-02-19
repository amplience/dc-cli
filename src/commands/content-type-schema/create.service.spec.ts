import { createContentTypeSchema } from './create.service';
import { ValidationLevel, Hub, ContentTypeSchema } from 'dc-management-sdk-js';

describe('create.service', () => {
  describe('createContentTypeSchema', () => {
    it('should create schema', async () => {
      const schemaBody = { $id: 'http://example.com/schema.json' };
      const schemaToCreate = {
        body: JSON.stringify(schemaBody),
        validationLevel: ValidationLevel.CONTENT_TYPE,
        schemaId: schemaBody.$id
      };
      const mockCreate = jest.fn().mockResolvedValue(new ContentTypeSchema(schemaToCreate));
      const mockHub = new Hub();
      mockHub.related.contentTypeSchema.create = mockCreate;
      const result = await createContentTypeSchema(JSON.stringify(schemaBody), ValidationLevel.CONTENT_TYPE, mockHub);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining(schemaToCreate));
      expect(result).toEqual(expect.objectContaining(schemaToCreate));
    });

    it('should throw and error when $id is missing from the schemaBody', async () => {
      await expect(
        createContentTypeSchema(JSON.stringify({}), ValidationLevel.CONTENT_TYPE, new Hub())
      ).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should throw and error when $id is invalid', async () => {
      await expect(
        createContentTypeSchema(JSON.stringify({ $id: '' }), ValidationLevel.CONTENT_TYPE, new Hub())
      ).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should throw an error if the schema body is invalid JSON', async () => {
      await expect(
        createContentTypeSchema('invalid json', ValidationLevel.CONTENT_TYPE, new Hub())
      ).rejects.toThrowErrorMatchingSnapshot();
    });
  });
});
