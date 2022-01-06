import { FileLog } from '../common/file-log';

export interface ExportItemBuilderOptions {
  dir: string;
  folderId?: string[] | string;
  repoId?: string[] | string;
  facet?: string;
  logFile: FileLog;
  publish?: boolean;

  exportedIds?: string[];
}
