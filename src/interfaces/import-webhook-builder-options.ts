import { FileLog } from '../common/file-log';

export interface ImportWebhookBuilderOptions {
  dir: string;
  logFile: FileLog;
  force?: boolean;
  silent?: boolean;
  mapFile?: string;
}
