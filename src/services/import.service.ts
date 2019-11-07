import fs from 'fs';
import path from 'path';

export type ImportResult = 'CREATED' | 'UPDATED' | 'UP-TO-DATE';

export enum UpdateStatus {
  SKIPPED = 'SKIPPED',
  UPDATED = 'UPDATED'
}

export const loadJsonFromDirectory = <T>(dir: string, withFilename = false): [string, T][] | T[] => {
  const files = fs
    .readdirSync(dir)
    .map(file => path.join(dir, file))
    .filter(file => fs.lstatSync(file).isFile() && path.extname(file) === '.json');
  return files.map(file => {
    try {
      const parsedFile = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (withFilename) {
        return [file, parsedFile];
      } else {
        return parsedFile;
      }
    } catch (e) {
      throw new Error(`Non-JSON file found: ${file}, aborting import`);
    }
  });
};
