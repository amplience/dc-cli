import { FileLog } from '../common/file-log';

export interface ImportItemBuilderOptions {
  dir: string;
  baseRepo?: string;
  baseFolder?: string;
  mapFile?: string;
  publish?: boolean;
  republish?: boolean;
  force?: boolean;
  validate?: boolean;
  skipIncomplete?: boolean;
  excludeKeys?: boolean;
  media?: boolean;
  logFile: FileLog;

  revertLog: Promise<FileLog | undefined>;
}
