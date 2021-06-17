import { CleanHubStepId } from '../commands/hub/model/clean-hub-step';
import { FileLog } from '../common/file-log';

export interface CleanHubBuilderOptions {
  logFile: FileLog;
  force?: boolean;
  step?: CleanHubStepId;
}
