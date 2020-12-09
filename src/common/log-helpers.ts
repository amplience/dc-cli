import { join } from 'path';

export function getDefaultLogPath(type: string, action: string, platform: string = process.platform): string {
  return join(
    process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname,
    '.amplience',
    `logs/${type}-${action}-<DATE>.log`
  );
}
