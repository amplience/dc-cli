interface SchemaJson {
  id?: string;
  $id?: string;
}

const resolveSchemaId = (schema: SchemaJson): string | undefined => (schema.$id !== undefined ? schema.$id : schema.id);

export default resolveSchemaId;
