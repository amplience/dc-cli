import fs from 'fs';

export interface ImportFile<O = {}> {
  uri: string;
  options: O;
}

export const getImportFileList = <T>(filePath: string): ImportFile<T>[] => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Unable to read manifest file list: ${filePath}`);
  }
};
