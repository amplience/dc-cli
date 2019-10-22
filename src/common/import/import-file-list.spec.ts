import fs from 'fs';
import { getImportFileList } from './import-file-list';

jest.mock('fs');

describe('import-file-list', () => {
  describe('getImportFileList', () => {
    afterEach((): void => {
      jest.resetAllMocks();
    });
    it('should return a file list containing a single file', () => {
      const manifest = [{ uri: '//remote-uri' }];
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(manifest));
      const result = getImportFileList('./manifest.json');
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync).toHaveBeenCalledWith('./manifest.json', 'utf-8');
      expect(result).toEqual(manifest);
    });

    it('should throw an error when manifest file contains invalid json', async () => {
      const manifest = 'invalid json';
      (fs.readFileSync as jest.Mock).mockReturnValue(manifest);
      expect(() => getImportFileList('./manifest.json')).toThrowErrorMatchingSnapshot();
    });

    it('should throw an error when manifest does not exist', async () => {
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File does not exist');
      });
      expect(() => getImportFileList('./manifest.json')).toThrowErrorMatchingSnapshot();
    });
  });
});
