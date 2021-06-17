/* eslint-disable @typescript-eslint/no-explicit-any */
import { CopyConfigFile, loadCopyConfig } from './copy-config';
import { Arguments } from 'yargs';
import { ConfigurationParameters } from '../../commands/configure';
import { FileLog } from '../file-log';
import { CopyItemBuilderOptions } from '../../interfaces/copy-item-builder-options.interface';

import * as fs from 'fs';

jest.mock('fs');

const yargArgs = {
  $0: 'test',
  _: ['test'],
  json: true,
  logFile: new FileLog()
};

describe('copy-config', () => {
  const writeFileMock = (fs.writeFile as any) as jest.Mock;
  const existsMock = (fs.existsSync as any) as jest.Mock;
  const readFileMock = (fs.readFile as any) as jest.Mock;
  const mkdirMock = (fs.mkdir as any) as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('loadCopyConfig', () => {
    it('should load a config file given a non-empty copyConfig argument', async () => {
      const testConfig = {
        dstClientId: 'test2',
        dstHubId: 'test',
        dstSecret: 'test3',
        srcClientId: 'test2',
        srcHubId: 'test',
        srcSecret: 'test3'
      };

      const oldLoad = CopyConfigFile.prototype.load;

      const loadMock = jest.fn().mockImplementation(function() {
        this.config = testConfig;
        return Promise.resolve(true);
      });
      CopyConfigFile.prototype.load = loadMock;

      const log = new FileLog();
      const argv: Arguments<ConfigurationParameters & CopyItemBuilderOptions> = {
        ...yargArgs,
        hubId: 'skipped',
        clientId: 'skipped',
        clientSecret: 'skipped',

        copyConfig: 'config.json'
      };

      const config = await loadCopyConfig(argv, log);

      expect(loadMock).toBeCalledWith(argv.copyConfig);
      expect(config).toEqual(testConfig);

      CopyConfigFile.prototype.load = oldLoad;
    });

    it('should log and return null if config file cannot be loaded', async () => {
      const oldLoad = CopyConfigFile.prototype.load;

      const loadMock = jest.fn().mockImplementation(function() {
        throw new Error('Loading failed.');
      });
      CopyConfigFile.prototype.load = loadMock;

      const log = new FileLog();
      const argv: Arguments<ConfigurationParameters & CopyItemBuilderOptions> = {
        ...yargArgs,
        hubId: 'skipped',
        clientId: 'skipped',
        clientSecret: 'skipped',

        copyConfig: 'config.json'
      };

      const config = await loadCopyConfig(argv, log);

      expect(loadMock).toBeCalledWith(argv.copyConfig);
      expect(config).toBeNull();

      CopyConfigFile.prototype.load = oldLoad;
    });

    it('should return a config object based on the arguments when no config file argument is given', async () => {
      const log = new FileLog();
      const argv: Arguments<ConfigurationParameters & CopyItemBuilderOptions> = {
        ...yargArgs,
        hubId: 'test',
        clientId: 'test2',
        clientSecret: 'test3'
      };

      const config = await loadCopyConfig(argv, log);

      expect(config).toMatchInlineSnapshot(`
        Object {
          "dstClientId": "test2",
          "dstHubId": "test",
          "dstSecret": "test3",
          "srcClientId": "test2",
          "srcHubId": "test",
          "srcSecret": "test3",
        }
      `);

      const argv2: Arguments<ConfigurationParameters & CopyItemBuilderOptions> = {
        ...yargArgs,
        hubId: 'test4',
        clientId: 'test5',
        clientSecret: 'test6',

        dstHubId: 'test7',
        dstClientId: 'test8',
        dstSecret: 'test9'
      };

      const config2 = await loadCopyConfig(argv2, log);

      expect(config2).toMatchInlineSnapshot(`
        Object {
          "dstClientId": "test8",
          "dstHubId": "test7",
          "dstSecret": "test9",
          "srcClientId": "test5",
          "srcHubId": "test4",
          "srcSecret": "test6",
        }
      `);
    });

    it("should create a config file based on the arguments when it doesn't already exist", async () => {
      const oldLoad = CopyConfigFile.prototype.load;
      const oldSave = CopyConfigFile.prototype.save;

      const loadMock = jest.fn().mockImplementation(function(filename: string) {
        expect(filename).toEqual('filename.json');
        return Promise.resolve(false);
      });
      CopyConfigFile.prototype.load = loadMock;

      const saveMock = jest.fn().mockImplementation(function(filename: string) {
        expect(filename).toEqual('filename.json');
        return Promise.resolve();
      });
      CopyConfigFile.prototype.save = saveMock;

      const log = new FileLog();
      const argv: Arguments<ConfigurationParameters & CopyItemBuilderOptions> = {
        ...yargArgs,
        hubId: 'test',
        clientId: 'test2',
        clientSecret: 'test3',

        dstHubId: 'test4',
        dstClientId: 'test5',
        dstSecret: 'test6',

        copyConfig: 'filename.json'
      };

      const config = await loadCopyConfig(argv, log);

      expect(config).toMatchInlineSnapshot(`
        Object {
          "dstClientId": "test5",
          "dstHubId": "test4",
          "dstSecret": "test6",
          "srcClientId": "test2",
          "srcHubId": "test",
          "srcSecret": "test3",
        }
      `);

      CopyConfigFile.prototype.load = oldLoad;
      CopyConfigFile.prototype.save = oldSave;
    });

    it('should continue normally even if new config cannot be saved', async () => {
      const oldLoad = CopyConfigFile.prototype.load;
      const oldSave = CopyConfigFile.prototype.save;

      const loadMock = jest.fn().mockImplementation(function(filename: string) {
        expect(filename).toEqual('filename.json');
        return Promise.resolve(false);
      });
      CopyConfigFile.prototype.load = loadMock;

      const saveMock = jest.fn().mockImplementation(function(filename: string) {
        expect(filename).toEqual('filename.json');
        throw new Error("Couldn't save");
      });
      CopyConfigFile.prototype.save = saveMock;

      const log = new FileLog();
      const argv: Arguments<ConfigurationParameters & CopyItemBuilderOptions> = {
        ...yargArgs,
        hubId: 'test',
        clientId: 'test2',
        clientSecret: 'test3',

        dstHubId: 'test4',
        dstClientId: 'test5',
        dstSecret: 'test6',

        copyConfig: 'filename.json'
      };

      const config = await loadCopyConfig(argv, log);

      expect(config).toMatchInlineSnapshot(`
        Object {
          "dstClientId": "test5",
          "dstHubId": "test4",
          "dstSecret": "test6",
          "srcClientId": "test2",
          "srcHubId": "test",
          "srcSecret": "test3",
        }
      `);

      CopyConfigFile.prototype.load = oldLoad;
      CopyConfigFile.prototype.save = oldSave;
    });
  });

  describe('copy-config-file', () => {
    it('should write the config as json to the given filename on save (creating dir)', async () => {
      existsMock.mockImplementation(input => {
        expect(input).toEqual('folder');
        return false;
      });

      mkdirMock.mockImplementation((input, callback) => {
        expect(input).toEqual('folder');
        callback();
      });

      writeFileMock.mockImplementation((filename, input, config, callback) => {
        expect(filename).toEqual('folder/write.json');
        expect(input).toMatchInlineSnapshot(
          `"{\\"srcHubId\\":\\"test\\",\\"srcClientId\\":\\"test2\\",\\"srcSecret\\":\\"test3\\",\\"dstHubId\\":\\"test4\\",\\"dstClientId\\":\\"test5\\",\\"dstSecret\\":\\"test6\\"}"`
        );
        callback();
      });

      const file = new CopyConfigFile();
      file.config = {
        srcHubId: 'test',
        srcClientId: 'test2',
        srcSecret: 'test3',

        dstHubId: 'test4',
        dstClientId: 'test5',
        dstSecret: 'test6'
      };
      await file.save('folder/write.json');
    });

    it('should write the config as json to the given filename on save (dir exists)', async () => {
      existsMock.mockImplementation(path => {
        expect(path).toEqual('folder');
        return true;
      });

      writeFileMock.mockImplementation((filename, input, config, callback) => {
        debugger;
        expect(filename).toEqual('folder/write.json');
        expect(input).toMatchInlineSnapshot(
          `"{\\"srcHubId\\":\\"test\\",\\"srcClientId\\":\\"test2\\",\\"srcSecret\\":\\"test3\\",\\"dstHubId\\":\\"test4\\",\\"dstClientId\\":\\"test5\\",\\"dstSecret\\":\\"test6\\"}"`
        );
        callback();
      });

      const file = new CopyConfigFile();
      file.config = {
        srcHubId: 'test',
        srcClientId: 'test2',
        srcSecret: 'test3',

        dstHubId: 'test4',
        dstClientId: 'test5',
        dstSecret: 'test6'
      };

      try {
        await file.save('folder/write.json');
      } catch (err) {
        debugger;
      }

      debugger;
      expect(mkdirMock).not.toHaveBeenCalled();
    });

    it('should read the config as json from the given filename on load', async () => {
      readFileMock.mockImplementationOnce((input, config, callback) => {
        expect(input).toEqual('goodFile.json');
        callback(false, '{ "srcClientId": "jsonString" }');
      });

      const file = new CopyConfigFile();
      const result = await file.load('goodFile.json');

      expect(result).toBeTruthy();
      expect(file.config).toMatchInlineSnapshot(`
        Object {
          "srcClientId": "jsonString",
        }
      `);
    });

    it('should throw if the given file does not contain valid JSON', async () => {
      readFileMock.mockImplementationOnce((input, config, callback) => {
        callback(false, 'not json');
      });

      const file = new CopyConfigFile();
      let throws = false;
      try {
        await file.load('invalidFile.json');
      } catch {
        throws = true;
      }

      expect(throws).toBeTruthy();
    });

    it('should return false if the file does not exist', async () => {
      readFileMock.mockImplementationOnce(() => {
        throw new Error('Not found.');
      });

      const file = new CopyConfigFile();
      const result = await file.load('badFile.json');

      expect(result).toBeFalsy();
    });
  });
});
