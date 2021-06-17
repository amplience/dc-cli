import { CloneHubStepId } from '../commands/hub/model/clone-hub-step';
import { CopyConfig } from '../common/content-item/copy-config';
import { FileLog } from '../common/file-log';

export interface CloneHubBuilderOptions {
  dir: string;

  dstHubId?: string;
  dstClientId?: string;
  dstSecret?: string;

  revertLog: Promise<FileLog | undefined>;
  step?: CloneHubStepId;

  mapFile?: string;
  force?: boolean;
  validate?: boolean;
  skipIncomplete?: boolean;
  media?: boolean;
  logFile: FileLog;
  copyConfig?: string | CopyConfig;

  lastPublish?: boolean;
  publish?: boolean;
  republish?: boolean;

  excludeKeys?: boolean;
}
