import { FileLog } from './file-log';
import { readFile, exists, unlink } from 'fs';
import { promisify } from 'util';
import { ensureDirectoryExists } from './import/directory-utils';

describe('file-log', () => {
  describe('file-log tests', () => {
    it('should create a log file when filename is specified, and closed', async () => {
      const log = new FileLog('file.log').open();
      log.appendLine('Test Message');
      const writeSpy = jest.spyOn(log, 'writeToFile').mockImplementation(() => Promise.resolve(true));
      await log.close();

      expect(writeSpy).toBeCalled();
    });

    it('should not create a log file when filename is null, and closed', async () => {
      const log = new FileLog().open();
      log.appendLine('Test Message');
      const writeSpy = jest.spyOn(log, 'writeToFile').mockImplementation(() => Promise.resolve(true));
      await log.close();

      expect(writeSpy).not.toBeCalled();
    });

    it('should embed the date in the filename', async () => {
      jest.spyOn(Date, 'now').mockImplementation(() => 1234);
      await ensureDirectoryExists('temp/');

      const log = new FileLog('temp/FileWithDate-<DATE>.log').open();
      log.appendLine('Test Message');
      await log.close();

      expect(await promisify(exists)('temp/FileWithDate-1234.log')).toBeTruthy();
      expect(await promisify(readFile)('temp/FileWithDate-1234.log', { encoding: 'utf-8' })).toMatchInlineSnapshot(`
        "// temp/FileWithDate-1234.log
        // Test Message
        SUCCESS"
      `);

      await promisify(unlink)('temp/FileWithDate-1234.log');
    });

    it('should only save the log after it has been closed as many times as it was opened', async () => {
      const log = new FileLog('notYet.log').open();

      // Add a nested open.
      log.open();

      log.appendLine('Test Message');
      const writeSpy = jest.spyOn(log, 'writeToFile').mockImplementation(() => Promise.resolve(true));
      await log.close();

      expect(writeSpy).not.toBeCalled(); // There is still a user, shouldn't save yet.

      await log.close();

      expect(writeSpy).toBeCalled();
    });

    it('should not save a log file if false is provided to the close method, and it is the last close', async () => {
      const log = new FileLog('noWrite.log').open();
      log.appendLine('Test Message');
      const writeSpy = jest.spyOn(log, 'writeToFile').mockImplementation(() => Promise.resolve(true));
      await log.close(false);

      expect(writeSpy).not.toBeCalled();
    });
  });
});
