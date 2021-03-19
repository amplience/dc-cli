import { Arguments } from 'yargs';
import { CleanHubBuilderOptions } from '../../../interfaces/clean-hub-builder-options';
import { ConfigurationParameters } from '../../configure';

export interface CleanHubStep {
  getName(): string;
  run(argv: Arguments<CleanHubBuilderOptions & ConfigurationParameters>): Promise<boolean>;
}
