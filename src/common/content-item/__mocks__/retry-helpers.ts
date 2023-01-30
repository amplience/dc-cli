import { FileLog } from '../../file-log';

let testCheck = false;

export const setTestCheck = (value: boolean): void => {
  testCheck = value;
};

export const waitOnTimeout = async (
  log: FileLog,
  request: () => Promise<unknown>,
  finishedCheck: () => Promise<boolean>
): Promise<void> => {
  if (testCheck) {
    try {
      await request();
    } catch {}
  } else {
    await request();
  }

  if (testCheck) {
    if (!(await finishedCheck())) {
      throw new Error('waitOnTimeout');
    }
  }
};
