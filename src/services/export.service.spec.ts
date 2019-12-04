import fs from 'fs';
import { writeJsonToFile } from './export.service';
import { uniqueFilename } from './export.service';
import { ContentType } from 'dc-management-sdk-js';

jest.mock('fs');

describe('export service tests', () => {
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
  });

  describe('writeJsonToFile tests', () => {
    it('should write the content type to the specified file', (): void => {
      const contentType = new ContentType({
        id: 'content-type-id-1',
        contentTypeUri: 'content-type-uri-1'
      });
      writeJsonToFile<ContentType>('my-filename', contentType);
      expect(fs.writeFileSync).toHaveBeenCalledWith('my-filename', JSON.stringify(contentType));
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
});
