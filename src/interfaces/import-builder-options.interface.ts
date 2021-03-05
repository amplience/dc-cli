import { FileLog } from '../common/file-log';

export interface ImportBuilderOptions {
  dir: string;
  logFile?: string | FileLog;
}
