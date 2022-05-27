import { FileLog } from '../file-log';

export default interface ArchiveOptions {
  id?: string | string[];
  name?: string | string[];
  fromDate?: string;
  toDate?: string;

  onlyInactive?: boolean;
  editions?: boolean;

  logFile: FileLog;
  force?: boolean;
  silent?: boolean;
  ignoreError?: boolean;
}
