import axios from 'axios';
import { URL } from 'url';
import * as fs from 'fs';

export async function jsonResolver(jsonToResolve: string): Promise<string> {
  try {
    const resolvedValue = JSON.parse(jsonToResolve);
    if (typeof resolvedValue === 'object' || Array.isArray(resolvedValue)) {
      return resolvedValue;
    }
  } catch {}

  if (jsonToResolve.match(/^(http|https):\/\//)) {
    const result = await axios.get(jsonToResolve);

    if (typeof result.data == 'string') {
      return result.data;
    }

    return JSON.stringify(result.data);
  }

  const localPath = jsonToResolve.match(/file:\/\//) ? new URL(jsonToResolve) : jsonToResolve;
  return fs.readFileSync(localPath, 'utf-8');
}
