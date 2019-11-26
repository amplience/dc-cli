import * as readline from 'readline';
import { promptToOverwriteExports } from './overwrite-prompt';
import { table } from 'table';

const mockQuestion = jest.fn();
const mockClose = jest.fn();

jest.mock('table');
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: mockQuestion,
    close: mockClose
  }))
}));

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

    const updatedExportsMap = [{ uri: 'my-content-type-uri', filename: 'my-export-filename' }];
    const res = await promptToOverwriteExports(updatedExportsMap);

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

    const updatedExportsMap = [{ uri: 'my-content-type-uri', filename: 'my-export-filename' }];
    const res = await promptToOverwriteExports(updatedExportsMap);

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

    const updatedExportsMap = [{ uri: 'my-content-type-uri', filename: 'my-export-filename' }];
    const res = await promptToOverwriteExports(updatedExportsMap);

    expect(res).toBeFalsy();
    expect(createInterfaceSpy).toHaveBeenCalledTimes(1);
    expect(mockQuestion).toHaveBeenCalledTimes(1);
    expect(mockQuestion.mock.calls).toMatchSnapshot();
    expect(stdoutSpy.mock.calls).toMatchSnapshot();
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect((table as jest.Mock).mock.calls).toMatchSnapshot();
  });
});
