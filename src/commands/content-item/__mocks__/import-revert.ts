import { ImportItemBuilderOptions } from '../../../interfaces/import-item-builder-options.interface';
import { ConfigurationParameters } from '../../configure';
import { Arguments } from 'yargs';

export const calls: Arguments<ImportItemBuilderOptions & ConfigurationParameters>[] = [];

export const revert = async (argv: Arguments<ImportItemBuilderOptions & ConfigurationParameters>): Promise<boolean> => {
  calls.push(argv);

  return true;
};
