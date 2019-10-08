import * as cli from './cli';
import Yargs from 'yargs/yargs';
import { configureCommandOptions } from './commands/configure';
import YargsCommandBuilderOptions from './common/yargs/yargs-command-builder-options';
import { basename } from 'path';

jest.mock('./commands/configure');

describe('cli', (): void => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const captureConsole = async (methodToWrap: () => void): Promise<string> => {
    let buffer = '';
    jest.spyOn(console, 'error').mockImplementation((output: string) => (buffer = `${buffer}${output}`));
    await methodToWrap();
    // replace config file and script entry point
    return buffer.replace(new RegExp(basename(process.argv[1]), 'g'), '<<ENTRYPOINT>>');
  };

  const throwErrorAndCaptureConsole = async (error: { message: string } | string | Error): Promise<string> => {
    return await captureConsole(async () => {
      await cli.displayError(error);
    });
  };

  it('should configure yarg instance', async (): Promise<void> => {
    const argv = Yargs(process.argv.slice(2));
    const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();
    const spyConfig = jest.spyOn(argv, 'config').mockReturnThis();
    const spyCommandDir = jest.spyOn(argv, 'commandDir').mockReturnThis();
    const spyDemandCommand = jest.spyOn(argv, 'demandCommand').mockReturnValue(argv);

    await cli.default(argv);

    expect(spyOptions).toHaveBeenCalledWith(configureCommandOptions);
    expect(spyConfig).toHaveBeenCalledWith('config', expect.any(Function));
    expect(spyCommandDir).toHaveBeenCalledWith('./commands', YargsCommandBuilderOptions);
    expect(spyDemandCommand).toHaveBeenCalledWith(1, 'Please specify at least one command');
  });

  it('should create a yarg instance if one is not supplied', async () => {
    configureCommandOptions.config.default = 'config.json';
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

    const buffer = await captureConsole(async () => {
      await cli.default();
    });

    expect(buffer).toMatchSnapshot();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should display sdk error (string)', async () => {
    const spyDisplayError = jest.spyOn(cli, 'displayError');
    expect(
      await throwErrorAndCaptureConsole(
        'The list-content-type-schemas action is not available, ensure you have permission to perform this action.'
      )
    ).toMatchSnapshot();
    expect(spyDisplayError).toHaveBeenCalled();
  });

  it('should display sdk error ({message})', async () => {
    const spyDisplayError = jest.spyOn(cli, 'displayError');
    expect(await throwErrorAndCaptureConsole({ message: 'Error message' })).toMatchSnapshot();
    expect(spyDisplayError).toHaveBeenCalled();
  });

  it('should display sdk error (Error)', async () => {
    const spyDisplayError = jest.spyOn(cli, 'displayError');
    expect(await throwErrorAndCaptureConsole(new Error('Error'))).toMatchSnapshot();
    expect(spyDisplayError).toHaveBeenCalled();
  });
});
