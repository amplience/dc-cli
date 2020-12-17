import fs from 'fs';
import path from 'path';
import { HalResource, HalResourceConstructor } from 'dc-management-sdk-js';

export type ImportResult = 'CREATED' | 'UPDATED' | 'UP-TO-DATE';

export enum UpdateStatus {
  SKIPPED = 'SKIPPED',
  UPDATED = 'UPDATED'
}

export const loadJsonFromDirectory = <T extends HalResource>(
  dir: string,
  resourceType: HalResourceConstructor<T>
): { [p: string]: T } => {
  if (!fs.existsSync(dir)) {
    return {};
  }

  const files = fs
    .readdirSync(dir)
    .map(file => path.resolve(dir, file))
    .filter(file => fs.lstatSync(file).isFile() && path.extname(file) === '.json');
  const loadedFiles: { [filename: string]: T } = {};
  files.forEach(filename => {
    try {
      loadedFiles[filename] = new resourceType(JSON.parse(fs.readFileSync(filename, 'utf-8')));
    } catch (e) {
      throw new Error(`Non-JSON file found: ${filename}, aborting...`);
    }
  });
  return loadedFiles;
};

export const loadFileFromDirectory = <json>(sourceFile: string): string => {
  return fs.readFileSync(sourceFile, { encoding: 'utf8' });
};
