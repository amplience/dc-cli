import { FileLog } from '../file-log';

export default interface ArchiveOptions {
  id?: string | string[];
  schemaId?: string | string[];
  revertLog?: string;
  repoId?: string | string[];
  folderId?: string | string[];
  facet?: string;

  logFile: FileLog;
  force?: boolean;
  silent?: boolean;
  ignoreError?: boolean;
}
