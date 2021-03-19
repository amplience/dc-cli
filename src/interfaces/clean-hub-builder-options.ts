import { FileLog } from '../common/file-log';

export interface CleanHubBuilderOptions {
  logFile?: string | FileLog;
  force?: boolean;
  step?: number;
}
