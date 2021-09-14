import { ArchiveLog, LogErrorLevel } from './archive-log';
import { writeFile, unlink } from 'fs';
import { promisify } from 'util';
import * as directoryUtils from '../import/directory-utils';
import { ensureDirectoryExists } from '../import/directory-utils';

describe('archive-log', () => {
  describe('archive-log tests', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return false when writing to file fails', async () => {
      const log = new ArchiveLog('Failing Log');
      log.addAction('ACTION', '1');

      jest.spyOn(directoryUtils, 'ensureDirectoryExists').mockImplementation(() => Promise.reject());

      const result = await log.writeToFile('failure.log');

      expect(result).toBeFalsy();
    });

    it('should recover the exit code when loading from file', async () => {
      await ensureDirectoryExists(`temp_${process.env.JEST_WORKER_ID}/`);

      // Code -1 is when the file is closed without an error type.

      const resultCodes = ['SUCCESS', 'WARNING', 'FAILURE'];
      for (let i = -1; i <= LogErrorLevel.ERROR; i++) {
        const errorType = i == -1 ? 0 : i;

        const errorStr = LogErrorLevel[errorType];
        const closingStr = resultCodes[errorType];

        const path = `temp_${process.env.JEST_WORKER_ID}/exit-${errorStr}.log`;

        await promisify(writeFile)(path, `// File Title\nACTION 1\n${closingStr}`);

        const log = new ArchiveLog();
        await log.loadFromFile(path);

        expect(log.title).toEqual('File Title');
        expect(log.getData('ACTION')).toEqual(['1']);
        expect(log.errorLevel).toEqual(i == -1 ? LogErrorLevel.NONE : i);

        await promisify(unlink)(path);
      }
    });
  });
});
