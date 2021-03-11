import fs from 'fs';
import { nothingExportedExit, promptToOverwriteExports, writeJsonToFile } from './export.service';
import { uniqueFilename } from './export.service';
import { ContentType } from 'dc-management-sdk-js';
import * as readline from 'readline';
import { table } from 'table';
import { FileLog } from '../common/file-log';

const mockQuestion = jest.fn();
const mockClose = jest.fn();

jest.mock('table');
jest.mock('fs');
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: mockQuestion,
    close: mockClose
  }))
}));

describe('export service tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('uniqueFilename tests', () => {
    it('should produce unique number-suffixed filenames if there are uris with the same base path', (): void => {
      const filenames: string[] = ['my-dir/text.json'];
      const filename = uniqueFilename('my-dir', 'https://mydomain/schemas/new/text.json', 'json', filenames);
      filenames.push(filename);
      const filename2 = uniqueFilename('my-dir', 'https://mydomain/schemas/newer/text.json', 'json', filenames);
      expect(filename).toEqual('my-dir/text-1.json');
      expect(filename2).toEqual('my-dir/text-2.json');
    });
    it('should produce unique file names', (): void => {
      const filenames: string[] = [];
      for (let n = 0; n < 100; n++) {
        const filename = uniqueFilename('my-dir', 'https://mydomain/schemas/text.json', 'json', filenames);
        if (filenames.includes(filename)) {
          fail(`non-unique filename ${filename}`);
        } else {
          filenames.push(filename);
        }
      }
    });
    it('should produce unique file names handling trailing slashes on the dir', (): void => {
      const filename = uniqueFilename('my-dir/', 'https://mydomain/schemas/new/text.json', 'json', []);
      expect(filename).toEqual('my-dir/text.json');
    });
  });

  describe('writeJsonToFile tests', () => {
    it('should write the content type to the specified file', (): void => {
      const contentType = new ContentType({
        id: 'content-type-id-1',
        contentTypeUri: 'content-type-uri-1'
      });
      writeJsonToFile<ContentType>('my-filename', contentType);
      expect(fs.writeFileSync).toHaveBeenCalledWith('my-filename', JSON.stringify(contentType, null, 2));
    });

    it('should throw an error if it cannot write to the file', (): void => {
      (fs.writeFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Cannot write to file/directory');
      });
      expect(() => writeJsonToFile<ContentType>('my-filename', new ContentType())).toThrowError(
        /^Unable to write file: my-filename, aborting export$/
      );
    });
  });

  describe('promptToOverwriteExports', () => {
    let createInterfaceSpy: jest.SpyInstance;
    let stdoutSpy: jest.SpyInstance;
    beforeEach(() => {
      createInterfaceSpy = jest.spyOn(readline, 'createInterface');
      stdoutSpy = jest.spyOn(process.stdout, 'write');
      stdoutSpy.mockImplementation();
    });

    afterEach(() => {
      createInterfaceSpy.mockClear();
      mockQuestion.mockClear();
      stdoutSpy.mockClear();
      mockClose.mockClear();
    });

    afterAll(() => {
      jest.resetAllMocks();
      jest.restoreAllMocks();
    });

    it('Should return true when the answer is "y"', async () => {
      mockQuestion.mockImplementation((question: string, cb: (answer: string) => Promise<boolean>) => {
        return cb('y');
      });

      const updatedExportsMap = [{ filename: 'my-export-filename', schemaId: 'my-content-type-uri' }];
      const res = await promptToOverwriteExports(updatedExportsMap, new FileLog());

      expect(res).toBeTruthy();
      expect(createInterfaceSpy).toHaveBeenCalledTimes(1);
      expect(mockQuestion).toHaveBeenCalledTimes(1);
      expect(mockQuestion.mock.calls).toMatchSnapshot();
      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect((table as jest.Mock).mock.calls).toMatchSnapshot();
    });

    it('Should return false when the answer is "n"', async () => {
      mockQuestion.mockImplementation((question: string, cb: (answer: string) => Promise<boolean>) => {
        return cb('n');
      });

      const updatedExportsMap = [{ filename: 'my-export-filename', schemaId: 'my-content-type-uri' }];
      const res = await promptToOverwriteExports(updatedExportsMap, new FileLog());

      expect(res).toBeFalsy();
      expect(createInterfaceSpy).toHaveBeenCalledTimes(1);
      expect(mockQuestion).toHaveBeenCalledTimes(1);
      expect(mockQuestion.mock.calls).toMatchSnapshot();
      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect((table as jest.Mock).mock.calls).toMatchSnapshot();
    });

    it('Should return false when the answer is anything but "y"', async () => {
      mockQuestion.mockImplementation((question: string, cb: (answer: string) => Promise<boolean>) => {
        return cb('');
      });

      const updatedExportsMap = [{ filename: 'my-export-filename', schemaId: 'my-content-type-uri' }];
      const res = await promptToOverwriteExports(updatedExportsMap, new FileLog());

      expect(res).toBeFalsy();
      expect(createInterfaceSpy).toHaveBeenCalledTimes(1);
      expect(mockQuestion).toHaveBeenCalledTimes(1);
      expect(mockQuestion.mock.calls).toMatchSnapshot();
      expect(stdoutSpy.mock.calls).toMatchSnapshot();
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect((table as jest.Mock).mock.calls).toMatchSnapshot();
    });
  });

  describe('nothingExportedExit', () => {
    it('should exit with an export message', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write');

      writeSpy.mockImplementation();

      nothingExportedExit(new FileLog());
      expect(writeSpy.mock.calls).toMatchSnapshot();
    });
  });
});
