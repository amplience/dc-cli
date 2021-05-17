import { join } from 'path';
import { FileLog } from './file-log';

export function getDefaultLogPath(type: string, action: string, platform: string = process.platform): string {
  return join(
    process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname,
    '.amplience',
    `logs/${type}-${action}-<DATE>.log`
  );
}

export function createLog(logFile: string, title?: string): FileLog {
  const log = new FileLog(logFile);

  if (title !== undefined) {
    const timestamp = Date.now().toString();

    log.title = `${title} - ${timestamp}\n`;
  }

  return log;
}
