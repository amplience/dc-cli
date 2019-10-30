import fs from 'fs';
import { loadJsonFromDirectory } from './import.service';
interface ImportObject {
  id: string;
}

describe('loadJsonFromDirectory tests', () => {
  it('should return a list of content types to import', (): void => {
    const importObjects: ImportObject[] = loadJsonFromDirectory<ImportObject>(
      __dirname + '/__fixtures__/load-json-from-directory/success/'
    );
    expect(importObjects).toEqual([
      JSON.parse(fs.readFileSync(__dirname + '/__fixtures__/load-json-from-directory/success/valid.json', 'utf-8'))
    ]);
  });

  it('should throw an error if any import file is not json', (): void => {
    expect(() =>
      loadJsonFromDirectory<ImportObject>(__dirname + '/__fixtures__/load-json-from-directory/bad-json/')
    ).toThrowError(
      /^Non-JSON file found: .*__fixtures__\/load-json-from-directory\/bad-json\/bad-json\.json, aborting import$/
    );
  });
});
