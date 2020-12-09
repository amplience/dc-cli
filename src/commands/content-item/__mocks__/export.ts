import { ExportItemBuilderOptions } from '../../../interfaces/export-item-builder-options.interface';
import { ConfigurationParameters } from '../../configure';
import { Arguments } from 'yargs';

export const calls: Arguments<ExportItemBuilderOptions & ConfigurationParameters>[] = [];

export const handler = async (
  argv: Arguments<ExportItemBuilderOptions & ConfigurationParameters>
): Promise<boolean> => {
  calls.push(argv);

  return true;
};
