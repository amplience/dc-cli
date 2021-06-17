import readline, { ReadLine } from 'readline';
import { FileLog } from './file-log';

function asyncQuestionInternal(rl: ReadLine, question: string): Promise<string> {
  return new Promise((resolve): void => {
    rl.question(question, resolve);
  });
}

export async function asyncQuestion(question: string, log?: FileLog): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  const answer = await asyncQuestionInternal(rl, question);
  rl.close();

  if (log != null) {
    log.appendLine(question + answer, true);
  }
  return answer.length > 0 && answer[0].toLowerCase() === 'y';
}
