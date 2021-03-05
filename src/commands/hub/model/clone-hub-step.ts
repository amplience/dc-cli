import { CloneHubState } from './clone-hub-state';

export interface CloneHubStep {
  getName(): string;
  run(state: CloneHubState): Promise<boolean>;
  revert(state: CloneHubState): Promise<boolean>;
}
