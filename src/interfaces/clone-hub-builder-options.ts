import { CopyConfig } from '../common/content-item/copy-config';
import { FileLog } from '../common/file-log';

export interface CloneHubBuilderOptions {
  dir: string;

  dstHubId?: string;
  dstClientId?: string;
  dstSecret?: string;

  revertLog?: string;
  step?: number;

  mapFile?: string;
  force?: boolean;
  validate?: boolean;
  skipIncomplete?: boolean;
  media?: boolean;
  logFile?: string | FileLog;
  copyConfig?: string | CopyConfig;

  lastPublish?: boolean;
  publish?: boolean;
  republish?: boolean;

  excludeKeys?: boolean;
}
