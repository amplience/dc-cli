import fs from 'fs';
import { HalResource } from 'dc-management-sdk-js';
import { resolve } from 'path';

export type ExportResult = 'EXPORTED' | 'RE-EXPORTED' | 'ALREADY-EXPORTED';

export const uniqueFilename = (dir: string, extension: string): string => {
  return resolve(
    dir,
    Math.random()
      .toString(36)
      .substr(2, 9) +
      '.' +
      extension
  );
};

export const writeJsonToFile = <T extends HalResource>(filename: string, resource: T): void => {
  try {
    fs.writeFileSync(filename, JSON.stringify(resource));
  } catch (e) {
    throw new Error(`Unable to write file: ${filename}, aborting export`);
  }
};
