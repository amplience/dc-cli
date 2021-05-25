import { FileLog } from '../common/file-log';

export interface ImportSettingsBuilderOptions {
  filePath: string;
  mapFile?: string;
  logFile: FileLog;
  force?: boolean;
}
