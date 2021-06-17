import { FileLog } from '../common/file-log';

export interface ExportBuilderOptions {
  dir: string;
  schemaId?: string[];
  archived?: boolean;
  logFile: FileLog;
  force?: boolean;
}
