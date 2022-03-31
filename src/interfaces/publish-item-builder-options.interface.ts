import { FileLog } from '../common/file-log';

export interface PublishItemBuilderOptions {
  facet?: string;
  logFile?: FileLog;
  repoId?: string[] | string;
  dryRun?: boolean;
}
