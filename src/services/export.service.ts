import fs from 'fs';
import { HalResource } from 'dc-management-sdk-js';
import * as path from 'path';
import { URL } from 'url';

export type ExportResult = 'CREATED' | 'UPDATED' | 'UP-TO-DATE';

export const uniqueFilename = (dir: string, uri: string, extension: string, exportFilenames: string[]): string => {
  const url = new URL(uri);
  const file = path.basename(url.pathname, '.' + extension) || url.hostname.replace('.', '_');
  let counter = 0;
  let uniqueFilename = '';
  do {
    if (counter == 0) {
      uniqueFilename = dir + path.sep + file + '.' + extension;
    } else {
      uniqueFilename = dir + path.sep + file + '-' + counter + '.' + extension;
    }
    counter++;
  } while (exportFilenames.includes(uniqueFilename));
  return uniqueFilename;
};

export const writeJsonToFile = <T extends HalResource>(filename: string, resource: T): void => {
  try {
    fs.writeFileSync(filename, JSON.stringify(resource));
  } catch (e) {
    throw new Error(`Unable to write file: ${filename}, aborting export`);
  }
};
