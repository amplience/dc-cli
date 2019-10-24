import fs from 'fs';
import path from 'path';
import { loadJsonFromDirectory } from './import.service';

interface ImportObject {
  id: string;
}

jest.mock('fs');

describe('loadJsonFromDirectory tests', () => {
  afterEach((): void => {
    jest.resetAllMocks();
  });
  it('should return a list of content types to import', (): void => {
    const mockFileReadDir = fs.readdirSync as jest.Mock;
    const mockFileNames: string[] = ['a.json'];
    mockFileReadDir.mockReturnValue(mockFileNames);
    const mockReadFile = fs.readFileSync as jest.Mock;
    const objectToImport = {
      id: 'content-type-id'
    };
    mockReadFile.mockReturnValue(JSON.stringify(objectToImport));
    const dirName = 'my-dir';
    const importObjects: ImportObject[] = loadJsonFromDirectory<ImportObject>(dirName);
    expect(importObjects).toEqual([objectToImport]);
    expect(mockFileReadDir).toHaveBeenCalledWith(dirName);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockReadFile).toHaveBeenCalledWith(path.join(dirName, mockFileNames[0]), 'utf-8');
  });

  it('should throw an error if any import file is not json', (): void => {
    const mockFileReadDir = fs.readdirSync as jest.Mock;
    const mockFileNames: string[] = ['a.json', 'b.json'];
    mockFileReadDir.mockReturnValue(mockFileNames);
    const mockReadFile = fs.readFileSync as jest.Mock;
    const mockContentType = 'invalid json';
    mockReadFile.mockReturnValue(mockContentType);
    const dirName = 'my-dir';
    expect(() => loadJsonFromDirectory<ImportObject>(dirName)).toThrowError(
      'Non-JSON file found: a.json, aborting import'
    );
    expect(mockFileReadDir).toHaveBeenCalledWith(dirName);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockReadFile).toHaveBeenCalledWith(path.join(dirName, mockFileNames[0]), 'utf-8');
  });
});
