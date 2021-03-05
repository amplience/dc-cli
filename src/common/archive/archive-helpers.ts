import { asyncQuestion } from '../log-helpers';

export async function confirmArchive(
  action: string,
  type: string,
  allContent: boolean,
  missingContent: boolean
): Promise<boolean> {
  const question = allContent
    ? `Providing no ID or filter will ${action} ALL ${type}! Are you sure you want to do this? (y/n)\n`
    : missingContent
    ? 'Warning: Some content specified on the log is missing. Are you sure you want to continue? (y/n)\n'
    : `Are you sure you want to ${action} these ${type}? (y/n)\n`;

  return await asyncQuestion(question);
}
