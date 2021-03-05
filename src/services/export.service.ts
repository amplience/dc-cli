import fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import DataPresenter from '../view/data-presenter';
import { asyncQuestion } from '../common/log-helpers';
import { FileLog } from '../common/file-log';

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
  } while (exportFilenames.find(filename => uniqueFilename.toLowerCase() === filename.toLowerCase()));
  return uniqueFilename;
};

export const uniqueFilename = (dir: string, uri = '', extension: string, exportFilenames: string[]): string => {
  const url = new URL(uri);
  const file = path.basename(url.pathname, '.' + extension) || url.hostname.replace('.', '_');
  return uniqueFilenamePath(dir, file, extension, exportFilenames);
};

export const writeJsonToFile = <T extends {}>(filename: string, resource: T): void => {
  try {
    fs.writeFileSync(filename, JSON.stringify(resource, null, 2));
  } catch (e) {
    throw new Error(`Unable to write file: ${filename}, aborting export`);
  }
};

export const promptToOverwriteExports = (
  updatedExportsMap: { [key: string]: string }[],
  log: FileLog
): Promise<boolean> => {
  log.appendLine('The following files will be overwritten:');
  // display updatedExportsMap as a table of uri x filename
  const itemMapFn = ({ filename, schemaId }: { filename: string; schemaId: string }): object => ({
    File: filename,
    'Schema ID': schemaId
  });
  new DataPresenter(updatedExportsMap).render({ itemMapFn, printFn: log.appendLine.bind(log) });

  return asyncQuestion('Do you want to continue (y/n)?: ', log);
};

export const promptToExportSettings = (filename: string, log: FileLog): Promise<boolean> => {
  return asyncQuestion(`Do you want to export setting to ${filename} (y/n)?: `, log);
};

export const nothingExportedExit = (log: FileLog, msg = 'Nothing was exported, exiting.'): void => {
  log.appendLine(msg);
  process.exit(1);
};
