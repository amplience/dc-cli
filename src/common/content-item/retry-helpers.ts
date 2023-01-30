import { HttpError } from 'dc-management-sdk-js';
import { FileLog } from '../file-log';

export const delay = (duration: number): Promise<void> => {
  return new Promise<void>((resolve): void => {
    setTimeout(resolve, duration);
  });
};

export const waitOnTimeout = async (
  log: FileLog,
  request: () => Promise<unknown>,
  finishedCheck: () => Promise<boolean>,
  throwErrors = true,
  retries = 30
): Promise<void> => {
  try {
    await request();
  } catch (error) {
    // If the HTTP error indicates a timeout, loop on the finished check until true, or the retry count is reached.

    const httpError = error as HttpError;

    // If the error doesn't have a response and the status is not 504, rethrow the exception.
    if (httpError.response == null || (throwErrors && httpError.response.status != 504)) {
      throw error;
    }

    // The error was a timeout. Periodically run the finished check to determine if the operation has completed.
    for (let i = 0; i < retries; i++) {
      try {
        log.appendLine(`Retrying... ${i + 1}/${retries}`);

        await delay(1000);

        if (await finishedCheck()) {
          break;
        }
      } catch (error) {
        // Retry failed, somehow.
        if (retries === i + 1) {
          throw error;
        } else {
          log.appendLine(`Retry failed. Continuing...`);
        }
      }

      if (retries === i + 1) {
        log.appendLine(`Out of retries. Throwing the original error.`);
        throw httpError;
      }
    }
  }
};
