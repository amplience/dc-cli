import fs from 'fs';
import { getRemoteFileList } from './list-remote-files';

jest.mock('fs');

describe('list-remote-files', () => {
  describe('getRemoteFileList', () => {
    afterEach((): void => {
      jest.resetAllMocks();
    });
    it('should return a file list containing a single file', () => {
      const remoteFiles = [{ uri: '//remote-uri' }];
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(remoteFiles));
      const result = getRemoteFileList('./remote-file-list.json');
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync).toHaveBeenCalledWith('./remote-file-list.json', 'utf-8');
      expect(result).toEqual(remoteFiles);
    });

    it('should throw an error when remote file list file contains invalid json', async () => {
      const remoteFiles = 'invalid json';
      (fs.readFileSync as jest.Mock).mockReturnValue(remoteFiles);
      expect(() => getRemoteFileList('./remote-file-list.json')).toThrowErrorMatchingSnapshot();
    });

    it('should throw an error when remote file list file does not exist', async () => {
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File does not exist');
      });
      expect(() => getRemoteFileList('./remote-file-list.json')).toThrowErrorMatchingSnapshot();
    });
  });
});
