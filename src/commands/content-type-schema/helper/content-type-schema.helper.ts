import axios from 'axios';
import { URL } from 'url';
import * as fs from 'fs';

export async function getSchemaBody(schema: string): Promise<string> {
  if (schema.match(/^(http|https):\/\//)) {
    const result = await axios.get(schema);

    if (typeof result.data == 'string') {
      return result.data;
    }

    return JSON.stringify(result.data);
  }

  const path = schema.match(/file:\/\//) ? new URL(schema) : schema;
  const schemaBody = fs.readFileSync(path, 'utf-8');
  return schemaBody;
}
