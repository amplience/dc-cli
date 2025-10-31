import { FileLog } from '../file-log';

export default interface ContentItemUnarchiveOptions {
  id?: string;
  schemaId?: string | string[];
  repoId?: string | string[];
  folderId?: string | string[];
  revertLog?: string;
  facet?: string;
  logFile: FileLog;
  force?: boolean;
  silent?: boolean;
  ignoreError?: boolean;
  ignoreSchemaValidation?: boolean;
}
