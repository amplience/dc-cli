import axios from 'axios';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';

export async function getJsonByPath(filename: string, relativeDir: string = __dirname): Promise<string> {
  if (filename.match(/^(http|https):\/\//)) {
    const result = await axios.get(filename);

    if (typeof result.data == 'string') {
      return result.data;
    }

    return JSON.stringify(result.data);
  }

  let resolvedFilename: string | URL = filename;
  if (filename.match(/file:\/\//)) {
    resolvedFilename = new URL(filename);
  } else if (filename.split(path.sep)[0].match(/^\.{1,2}$/)) {
    resolvedFilename = path.resolve(relativeDir, filename);
  }

  if (!fs.existsSync(resolvedFilename)) {
    throw new Error(
      `Cannot find JSON file "${filename}" using relative dir "${relativeDir}" (resolved path "${resolvedFilename}")`
    );
  }

  return fs.readFileSync(resolvedFilename, 'utf-8');
}
