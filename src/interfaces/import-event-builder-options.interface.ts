import { FileLog } from '../common/file-log';

export interface ImportEventBuilderOptions {
  dir: string;
  mapFile?: string;
  originalIds: boolean;
  schedule: boolean;
  experimental: boolean;
  catchup: boolean;
  logFile: FileLog;
}
