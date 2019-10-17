import axios from 'axios';
import { URL } from 'url';
import * as fs from 'fs';

export async function getExternalJson(path: string): Promise<string> {
  if (path.match(/^(http|https):\/\//)) {
    const result = await axios.get(path);

    if (typeof result.data == 'string') {
      return result.data;
    }

    return JSON.stringify(result.data);
  }

  const localPath = path.match(/file:\/\//) ? new URL(path) : path;
  const schemaBody = fs.readFileSync(localPath, 'utf-8');
  return schemaBody;
}
