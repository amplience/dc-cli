import { CloneHubState } from './clone-hub-state';

export enum CloneHubStepId {
  Settings = 'settings',
  Extension = 'extension',
  Schema = 'schema',
  Type = 'type',
  Index = 'index',
  Content = 'content'
}

export interface CloneHubStep {
  getId(): CloneHubStepId;
  getName(): string;
  run(state: CloneHubState): Promise<boolean>;
  revert(state: CloneHubState): Promise<boolean>;
}
