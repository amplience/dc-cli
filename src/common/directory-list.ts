import * as fs from 'fs';

export const listDirectory = (dir: string): string[] => {
  try {
    return fs.readdirSync(dir);
  } catch (err) {
    throw new Error(`Unable to read ${dir}`);
  }
};
