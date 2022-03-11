import { CopyItemBuilderOptions } from '../../../interfaces/copy-item-builder-options.interface';
import { ConfigurationParameters } from '../../configure';
import { Arguments } from 'yargs';

let exportIds: string[];
let importIds: string[];
let forceFail = false;
export const calls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = [];

export const setOutputIds = (exports: string[], imports: string[]): void => {
  exportIds = exports;
  importIds = imports;
};

export const setForceFail = (fail: boolean): void => {
  forceFail = fail;
};

export const handler = async (argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters>): Promise<boolean> => {
  calls.push(argv);
  const importedIds = argv.importedIds as string[];
  const exportedIds = argv.exportedIds as string[];

  if (importedIds) {
    importedIds.push(...importIds);
  }

  if (exportedIds) {
    exportedIds.push(...exportIds);
  }

  return !forceFail;
};
