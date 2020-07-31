import { FileLog } from '../common/file-log';

export interface ImportItemBuilderOptions {
  dir: string;
  baseRepo?: string;
  baseFolder?: string;
  mapFile?: string;
  force?: boolean;
  validate?: boolean;
  skipIncomplete?: boolean;
  logFile?: string | FileLog;

  revertLog?: string;
}
