import { FileLog } from '../common/file-log';

export interface CleanHubBuilderOptions {
  logFile: FileLog;
  force?: boolean;
  step?: number;
}
