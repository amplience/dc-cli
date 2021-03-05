import { FileLog } from '../common/file-log';

export interface ImportSettingsBuilderOptions {
  filePath: string;
  mapFile?: string;
  logFile?: string | FileLog;
  force?: boolean;
}
