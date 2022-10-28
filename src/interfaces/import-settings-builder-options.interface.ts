import { FileLog } from '../common/file-log';

export interface ImportSettingsBuilderOptions {
  filePath: string;
  allowDelete?: boolean;
  mapFile?: string;
  logFile: FileLog;
  force?: boolean;
}
