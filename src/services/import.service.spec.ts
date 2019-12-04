import fs from 'fs';
import { loadJsonFromDirectory } from './import.service';
import { ContentType } from 'dc-management-sdk-js';

describe('loadJsonFromDirectory tests', () => {
  it('should return a list of content types to import', (): void => {
    const result = loadJsonFromDirectory<ContentType>(
      __dirname + '/__fixtures__/load-json-from-directory/success/',
      ContentType
    );
    const filename = __dirname + '/__fixtures__/load-json-from-directory/success/valid.json';
    expect(result[filename]).toBeDefined();
    expect(result[filename]).toBeInstanceOf(ContentType);
    expect(result[filename].toJSON()).toEqual(JSON.parse(fs.readFileSync(filename, 'utf-8').toString()));
  });

  it('should throw an error if any import file is not json', (): void => {
    expect(() =>
      loadJsonFromDirectory<ContentType>(__dirname + '/__fixtures__/load-json-from-directory/bad-json/', ContentType)
    ).toThrowError(
      /^Non-JSON file found: .*__fixtures__\/load-json-from-directory\/bad-json\/bad-json\.json, aborting...$/
    );
  });
});
