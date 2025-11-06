import { FileLog } from '../common/file-log';

export interface DeleteWebhookBuilderOptions {
  logFile: FileLog;
  force?: boolean;
}
