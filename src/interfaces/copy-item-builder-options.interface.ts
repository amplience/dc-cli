import { CopyConfig } from '../common/content-item/copy-config';
import { FileLog } from '../common/file-log';

export interface CopyItemBuilderOptions {
  srcRepo?: string;
  srcFolder?: string;

  dstRepo?: string;
  dstFolder?: string;

  dstHubId?: string;
  dstClientId?: string;
  dstSecret?: string;

  schemaId?: string[] | string;
  name?: string[] | string;

  mapFile?: string;
  force?: boolean;
  validate?: boolean;
  skipIncomplete?: boolean;
  media?: boolean;
  logFile: FileLog;
  copyConfig?: string | CopyConfig;

  revertLog?: string;

  lastPublish?: boolean;
  publish?: boolean;
  republish?: boolean;

  excludeKeys?: boolean;

  exportedIds?: string[];
}
