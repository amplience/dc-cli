import fs from 'fs';
import path from 'path';

export type ImportResult = 'CREATED' | 'UPDATED' | 'UP-TO-DATE';

export enum UpdateStatus {
  SKIPPED = 'SKIPPED',
  UPDATED = 'UPDATED'
}

export const loadJsonFromDirectory = <T>(dir: string): T[] => {
  const files = fs
    .readdirSync(dir)
    .map(file => path.join(dir, file))
    .filter(file => fs.lstatSync(file).isFile());
  return files.map(file => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
      throw new Error(`Non-JSON file found: ${file}, aborting import`);
    }
  });
};
