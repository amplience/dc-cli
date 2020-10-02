import { FileLog } from '../common/file-log';

export interface CopyItemBuilderOptions {
  srcRepo?: string;
  srcFolder?: string;

  dstRepo?: string;
  dstFolder?: string;

  dstHub?: string;
  dstClientId?: string;
  dstSecret?: string;

  schemaId?: string[] | string;
  name?: string[] | string;

  mapFile?: string;
  force?: boolean;
  validate?: boolean;
  skipIncomplete?: boolean;
  logFile?: string | FileLog;

  revertLog?: string;

  exportedIds?: string[];
}
