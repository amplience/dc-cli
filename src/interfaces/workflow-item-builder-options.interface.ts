import { FileLog } from '../common/file-log';

export interface WorkflowItemBuilderOptions {
  facet?: string;
  logFile?: FileLog;
  repoId?: string[] | string;
  targetWorkflowLabel?: string;
}
