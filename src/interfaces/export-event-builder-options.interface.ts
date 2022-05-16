import { FileLog } from '../common/file-log';

export interface ExportEventBuilderOptions {
  dir: string;
  id?: string;
  fromDate?: string;
  toDate?: string;
  logFile: FileLog;
  snapshots: boolean;
}
