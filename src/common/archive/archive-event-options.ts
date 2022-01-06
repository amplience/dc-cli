import { FileLog } from '../file-log';

export default interface ArchiveOptions {
  id?: string | string[];

  name?: string | string[];

  logFile: FileLog;
  force?: boolean;
  silent?: boolean;
  ignoreError?: boolean;
}
