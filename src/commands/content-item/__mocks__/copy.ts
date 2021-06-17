import { CopyItemBuilderOptions } from '../../../interfaces/copy-item-builder-options.interface';
import { ConfigurationParameters } from '../../configure';
import { Arguments } from 'yargs';

let outputIds: string[];
let forceFail = false;
export const calls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = [];

export const setOutputIds = (ids: string[]): void => {
  outputIds = ids;
};

export const setForceFail = (fail: boolean): void => {
  forceFail = fail;
};

export const handler = async (argv: Arguments<CopyItemBuilderOptions & ConfigurationParameters>): Promise<boolean> => {
  calls.push(argv);
  const idOut = argv.exportedIds as string[];

  if (idOut) {
    idOut.push(...outputIds);
  }

  return !forceFail;
};
