import { createLog, getDefaultLogPath } from './log-helpers';
import { join } from 'path';
import { setVersion } from './file-log';

setVersion('test-ver');

describe('log-helpers', () => {
  describe('getDefaultLogPath tests', () => {
    it('should build a log path out of the given type, action and platform', async () => {
      process.env['USERPROFILE'] = '/win32path';
      process.env['HOME'] = '/unixpath';

      const pathWin = getDefaultLogPath('example1', 'action1', 'win32');
      expect(pathWin).toMatchInlineSnapshot(`"/win32path/.amplience/logs/example1-action1-<DATE>.log"`);

      const pathUnix = getDefaultLogPath('example2', 'action2', 'unix');
      expect(pathUnix).toMatchInlineSnapshot(`"/unixpath/.amplience/logs/example2-action2-<DATE>.log"`);

      const pathAuto = getDefaultLogPath('example3', 'action3');
      if (process.platform === 'win32') {
        expect(pathAuto).toMatchInlineSnapshot(`"/win32path/.amplience/logs/example3-action3-<DATE>.log"`);
      } else {
        expect(pathAuto).toMatchInlineSnapshot(`"/unixpath/.amplience/logs/example3-action3-<DATE>.log"`);
      }

      delete process.env['HOME'];

      const pathUndefined = getDefaultLogPath('example2', 'action2', 'unix');
      expect(pathUndefined).toEqual(join(__dirname, '/.amplience/logs/example2-action2-<DATE>.log'));
    });
  });

  describe('createLog tests', () => {
    it('should create a log instance with the given filename, without opening it', async () => {
      const log = createLog('exampleFilename.txt');

      // Undefined title matches the filename.
      expect(log.title).toEqual('dc-cli test-ver - exampleFilename.txt');
      expect(log['filename']).toEqual('exampleFilename.txt');
      expect(log['openedCount']).toEqual(0);
    });

    it('should create a log instance with the given filename, without opening it', async () => {
      const log = createLog('exampleFilename.txt');

      // Undefined title matches the filename.
      expect(log.title).toEqual('dc-cli test-ver - exampleFilename.txt');
      expect(log['filename']).toEqual('exampleFilename.txt');
      expect(log['openedCount']).toEqual(0);
    });

    it('should create a log instance with the given title, adding a timestamp afterwards', async () => {
      const log = createLog('exampleFilename2.txt', 'title with timestamp');

      // Followed by timestamp.
      expect(log.title).toMatch(/^dc\-cli test\-ver \- title with timestamp \- ./);
      expect(log['filename']).toEqual('exampleFilename2.txt');
      expect(log['openedCount']).toEqual(0);
    });
  });
});
