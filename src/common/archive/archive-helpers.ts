import { join } from 'path';
import readline, { ReadLine } from 'readline';

export function getDefaultLogPath(type: string, action: string, platform: string = process.platform): string {
  return join(
    process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname,
    '.amplience',
    `logs/${type}-${action}-<DATE>.log`
  );
}

function asyncQuestion(rl: ReadLine, question: string): Promise<string> {
  return new Promise((resolve): void => {
    rl.question(question, resolve);
  });
}

export async function confirmArchive(
  action: string,
  type: string,
  allContent: boolean,
  missingContent: boolean
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  const question = allContent
    ? `Providing no ID or filter will ${action} ALL ${type}! Are you sure you want to do this? (y/n)\n`
    : missingContent
    ? 'Warning: Some content specified on the log is missing. Are you sure you want to continue? (y/n)\n'
    : `Are you sure you want to ${action} these ${type}? (y/n)\n`;

  const answer: string = await asyncQuestion(rl, question);
  rl.close();
  return answer.length > 0 && answer[0].toLowerCase() == 'y';
}
