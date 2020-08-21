import axios from 'axios';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';

export async function jsonResolver(jsonToResolve = '', relativeDir: string = __dirname): Promise<string> {
  try {
    const resolvedJson = JSON.parse(jsonToResolve);
    if (resolvedJson && (Array.isArray(resolvedJson) || typeof resolvedJson === 'object')) {
      return jsonToResolve;
    }
  } catch {}

  if (jsonToResolve.match(/^(http|https):\/\//)) {
    const result = await axios.get(jsonToResolve, { transformResponse: data => data });
    return result.data;
  }

  let resolvedFilename: string | URL = jsonToResolve;
  if (jsonToResolve.match(/file:\/\//)) {
    resolvedFilename = new URL(jsonToResolve);
  } else if (jsonToResolve.split(path.sep)[0].match(/^\.{1,2}$/)) {
    resolvedFilename = path.resolve(relativeDir, jsonToResolve);
  }

  if (!fs.existsSync(resolvedFilename)) {
    throw new Error(
      `Cannot find JSON file "${jsonToResolve}" using relative dir "${relativeDir}" (resolved path "${resolvedFilename}")`
    );
  }

  return fs.readFileSync(resolvedFilename, 'utf-8');
}
