import { FileLog } from '../file-log';

export default interface PublishOptions {
  id?: string | string[];
  repoId?: string | string[];
  folderId?: string | string[];
  facet?: string;
  logFile: FileLog;
  force?: boolean;
  silent?: boolean;
  publishRateLimit?: number;
}
