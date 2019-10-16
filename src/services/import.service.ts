import fs from 'fs';
import path from 'path';

export const extractImportObjects = <T>(dir: string): T[] => {
  const files = fs.readdirSync(dir);
  return files.map(fileName => {
    const file = fs.readFileSync(path.join(dir, fileName), 'utf-8');
    try {
      return JSON.parse(file);
    } catch (e) {
      throw new Error(`Non-JSON file found: ${fileName}, aborting import`);
    }
  });
};
