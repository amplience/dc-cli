import { FileLog } from './file-log';
import { readFile, exists, unlink } from 'fs';
import { promisify } from 'util';
import { ensureDirectoryExists } from './import/directory-utils';

describe('file-log', () => {
  describe('file-log tests', () => {
    it('should create a log file when filename is specified, and closed', async () => {
      const log = new FileLog('file.log');
      log.appendLine('Test Message');
      const writeSpy = jest.spyOn(log, 'writeToFile').mockImplementation(() => Promise.resolve(true));
      await log.close();

      expect(writeSpy).toBeCalled();
    });

    it('should not create a log file when filename is null, and closed', async () => {
      const log = new FileLog();
      log.appendLine('Test Message');
      const writeSpy = jest.spyOn(log, 'writeToFile').mockImplementation(() => Promise.resolve(true));
      await log.close();

      expect(writeSpy).not.toBeCalled();
    });

    it('should embed the date in the filename', async () => {
      jest.spyOn(Date, 'now').mockImplementation(() => 1234);
      await ensureDirectoryExists('temp/');

      const log = new FileLog('temp/FileWithDate-<DATE>.log');
      log.appendLine('Test Message');
      await log.close();

      expect(await promisify(exists)('temp/FileWithDate-1234.log')).toBeTruthy();
      expect(await promisify(readFile)('temp/FileWithDate-1234.log', { encoding: 'utf-8' })).toMatchInlineSnapshot(`
        "// temp/FileWithDate-1234.log
        // Test Message
        "
      `);

      await promisify(unlink)('temp/FileWithDate-1234.log');
    });
  });
});
