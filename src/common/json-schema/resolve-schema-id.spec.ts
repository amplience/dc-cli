import resolveSchemaId from './resolve-schema-id';

describe('resolve-schema-id', () => {
  it('should resolve a pre version 7 id', () => {
    const schemaBody = { id: 'http://example.com/schema.json' };
    expect(resolveSchemaId(schemaBody)).toBe('http://example.com/schema.json');
  });
  it('should resolve to an unknown id', () => {
    const schemaBody = {};
    expect(resolveSchemaId(schemaBody)).toBe(undefined);
  });
  it('should resolve a version 7 id', () => {
    const schemaBody = { $id: 'http://example.com/schema.json' };
    expect(resolveSchemaId(schemaBody)).toBe('http://example.com/schema.json');
  });
});
