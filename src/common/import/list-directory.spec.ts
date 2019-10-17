import fs from 'fs';
import { listDirectory } from './list-directory';

jest.mock('fs');

describe('list-directory', () => {
  describe('listDirectory', () => {
    afterEach((): void => {
      jest.resetAllMocks();
    });
    it('should return a list of files from a directory', () => {
      const directoryFileNames = ['file-a.json', 'file-b.json'];
      (fs.readdirSync as jest.Mock).mockReturnValue(directoryFileNames);
      const result = listDirectory('./dir-name');
      expect(result).toEqual(directoryFileNames);
    });

    it('should throw an error when directory read fails', () => {
      (fs.readdirSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Directory does not exist');
      });
      expect(() => listDirectory('./dir-name')).toThrowErrorMatchingSnapshot();
    });
  });
});
