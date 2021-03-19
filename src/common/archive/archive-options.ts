import { FileLog } from '../file-log';

export default interface ArchiveOptions {
  id?: string;
  schemaId?: string | string[];
  revertLog?: string;
  repoId?: string | string[];
  folderId?: string | string[];
  name?: string | string[];
  contentType?: string | string[];
  logFile?: string | FileLog;
  force?: boolean;
  silent?: boolean;
  ignoreError?: boolean;
}
