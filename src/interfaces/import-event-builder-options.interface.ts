import { FileLog } from '../common/file-log';

export interface ImportEventBuilderOptions {
  dir: string;
  mapFile?: string;
  originalIds: boolean;
  schedule: boolean;
  acceptSnapshotLimits: boolean;
  catchup: boolean;
  logFile: FileLog;
}
