import { promisify } from 'util';
import { mkdir, exists, lstat } from 'fs';
import { sep } from 'path';

export async function ensureDirectoryExists(dir: string): Promise<void> {
  if (await promisify(exists)(dir)) {
    const dirStat = await promisify(lstat)(dir);
    if (!dirStat || !dirStat.isDirectory()) {
      throw new Error(`"${dir}" already exists and is not a directory.`);
    }
  } else {
    // Ensure parent directory exists.
    const parentPath = dir.split(sep);
    parentPath.pop();
    const parent = parentPath.join(sep);
    if (parentPath.length > 0) {
      await ensureDirectoryExists(parent);
    }

    if (dir.length > 0) {
      try {
        await promisify(mkdir)(dir);
      } catch (e) {
        if (await promisify(exists)(dir)) {
          return; // This directory could have been created after we checked if it existed.
        }
        throw new Error(`Unable to create directory: "${dir}".`);
      }
    }
  }
}
