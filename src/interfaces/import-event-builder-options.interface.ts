import { FileLog } from '../common/file-log';

export interface ImportEventBuilderOptions {
  dir: string;
  mapFile?: string;
  originalIds: boolean;
  logFile: FileLog;
}
