import { ImportItemBuilderOptions } from '../../../interfaces/import-item-builder-options.interface';
import { ConfigurationParameters } from '../../configure';
import { Arguments } from 'yargs';

type ReturnType = boolean | 'throw';
let expectedReturn: ReturnType = true;

export const calls: Arguments<ImportItemBuilderOptions & ConfigurationParameters>[] = [];
export const setExpectedReturn = (value: ReturnType): void => {
  expectedReturn = value;
};

export const handler = async (
  argv: Arguments<ImportItemBuilderOptions & ConfigurationParameters>
): Promise<boolean> => {
  calls.push(argv);

  if (expectedReturn == 'throw') {
    throw new Error('Forced throw in test.');
  }

  return expectedReturn;
};
