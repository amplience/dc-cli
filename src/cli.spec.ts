import cli from './cli';
import CommandLineParserService from './configuration/command-line-parser.service';
//
const mockParse = jest.fn();
const mockStoreGlobal = jest.fn();
jest.mock('./configuration/command-line-parser.service', () => {
  return {
    default: function(): CommandLineParserService {
      return {
        parse: mockParse,
        storeGlobal: mockStoreGlobal
      };
    }
  };
});

describe('cli', (): void => {
  it('should invoke parse', (): void => {
    jest.resetAllMocks();
    cli();
    expect(mockParse).toBeCalled();
  });
});
