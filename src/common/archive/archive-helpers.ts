import readline, { ReadLine } from 'readline';

function asyncQuestionInternal(rl: ReadLine, question: string): Promise<string> {
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

  const answer: string = await asyncQuestionInternal(rl, question);
  rl.close();
  return answer.length > 0 && answer[0].toLowerCase() == 'y';
}

export async function asyncQuestion(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  const answer = await asyncQuestionInternal(rl, question);

  rl.close();
  return answer.length > 0 && answer[0].toLowerCase() === 'y';
}
