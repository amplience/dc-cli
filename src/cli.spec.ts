import cli from './cli';
import CommandLineParserService from './configuration/command-line-parser.service';

jest.mock('./configuration/command-line-parser.service');

describe('cli', (): void => {
  it('should invoke parse', (): void => {
    cli();

    const commandLineParserServiceMock = CommandLineParserService as jest.Mock;
    expect(commandLineParserServiceMock).toBeCalled();
    const createdInstance = commandLineParserServiceMock.mock.instances[0];
    expect(createdInstance.parse).toHaveBeenCalled();
  });
});
