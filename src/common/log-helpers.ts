import { join } from 'path';
import { LogErrorLevel } from './archive/archive-log';
import { FileLog, versionedTitle } from './file-log';

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

    log.title = versionedTitle(`${title} - ${timestamp}\n`);
  }

  return log;
}

export async function openRevertLog(filename: string): Promise<FileLog | undefined> {
  if (filename == null) {
    return undefined;
  }

  const log = new FileLog();

  try {
    await log.loadFromFile(filename);
  } catch {
    log.errorLevel = LogErrorLevel.INVALID;
  }

  return log;
}
