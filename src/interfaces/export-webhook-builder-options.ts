import { FileLog } from '../common/file-log';

export interface ExportWebhookBuilderOptions {
  dir: string;
  id?: string | string[];
  logFile: FileLog;
  force?: boolean;
  silent?: boolean;
}
