import { Arguments } from 'yargs';
import { CleanHubBuilderOptions } from '../../../interfaces/clean-hub-builder-options';
import { ConfigurationParameters } from '../../configure';

export enum CleanHubStepId {
  Content = 'content',
  Type = 'type',
  Schema = 'schema'
}

export interface CleanHubStep {
  getId(): CleanHubStepId;
  getName(): string;
  run(argv: Arguments<CleanHubBuilderOptions & ConfigurationParameters>): Promise<boolean>;
}
