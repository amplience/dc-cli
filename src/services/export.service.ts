import fs from 'fs';
import { HalResource } from 'dc-management-sdk-js';
import * as path from 'path';
import { URL } from 'url';
import DataPresenter from '../view/data-presenter';
import readline from 'readline';

export type ExportResult = 'CREATED' | 'UPDATED' | 'UP-TO-DATE';

export const uniqueFilenamePath = (dir: string, file = '', extension: string, exportFilenames: string[]): string => {
  if (dir.substr(-1) === path.sep) {
    dir = dir.slice(0, -1);
  }

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

export const uniqueFilename = (dir: string, uri = '', extension: string, exportFilenames: string[]): string => {
  const url = new URL(uri);
  const file = path.basename(url.pathname, '.' + extension) || url.hostname.replace('.', '_');
  return uniqueFilenamePath(dir, file, extension, exportFilenames);
};

export const writeJsonToFile = <T extends HalResource>(filename: string, resource: T): void => {
  try {
    fs.writeFileSync(filename, JSON.stringify(resource, null, 2));
  } catch (e) {
    throw new Error(`Unable to write file: ${filename}, aborting export`);
  }
};

export const promptToOverwriteExports = (updatedExportsMap: { [key: string]: string }[]): Promise<boolean> => {
  return new Promise((resolve): void => {
    process.stdout.write('The following files will be overwritten:\n');
    // display updatedExportsMap as a table of uri x filename
    const itemMapFn = ({ filename, schemaId }: { filename: string; schemaId: string }): object => ({
      File: filename,
      'Schema ID': schemaId
    });
    new DataPresenter(updatedExportsMap).render({ itemMapFn });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Do you want to continue (y/n)?: ', answer => {
      rl.close();
      return resolve(answer === 'y');
    });
  });
};

export const nothingExportedExit = (msg = 'Nothing was exported, exiting.\n'): void => {
  process.stdout.write(msg);
  process.exit(1);
};
