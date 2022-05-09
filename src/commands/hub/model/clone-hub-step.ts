import { CloneHubState } from './clone-hub-state';

export enum CloneHubStepId {
  Settings = 'settings',
  Extension = 'extension',
  Schema = 'schema',
  Type = 'type',
  Index = 'index',
  Content = 'content',
  Event = 'event'
}

export interface CloneHubStep {
  getId(): CloneHubStepId;
  getName(): string;
  isLimited?: boolean;
  run(state: CloneHubState): Promise<boolean>;
  revert(state: CloneHubState): Promise<boolean>;
}
