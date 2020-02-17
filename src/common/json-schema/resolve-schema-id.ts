interface SchemaJson {
  id?: string;
  $id?: string;
}

const resolveSchemaId = (schema: SchemaJson): string | undefined => {
  if (schema.id || schema.$id) {
    return schema.id || schema.$id;
  }

  return;
};

export default resolveSchemaId;
