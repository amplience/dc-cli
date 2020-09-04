import { FileLog } from '../common/file-log';

export interface ExportItemBuilderOptions {
  dir: string;
  folderId?: string[] | string;
  repoId?: string[] | string;
  schemaId?: string[] | string;
  name?: string[] | string;
  logFile?: string | FileLog;
  publish?: boolean;

  exportedIds?: string[];
}
