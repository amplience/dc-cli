import * as cli from './cli';
import Yargs from 'yargs/yargs';
import { configureCommandOptions } from './commands/configure';
import YargsCommandBuilderOptions from './common/yargs/yargs-command-builder-options';

jest.mock('./commands/configure');

jest.useFakeTimers().setSystemTime(new Date('2025-02-24T01:01:01.001Z'));

describe('cli', (): void => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const captureConsole = async (methodToWrap: () => void): Promise<string> => {
    let buffer = '';
    jest.spyOn(console, 'error').mockImplementation((output: string) => (buffer = `${buffer}${output}`));
    await methodToWrap();
    // replace config file and script entry point
    return buffer;
  };

  it('should configure yarg instance', async (): Promise<void> => {
    const argv = Yargs(process.argv.slice(2));
    const spyCommandDir = jest.spyOn(argv, 'commandDir').mockReturnThis();
    const spyDemandCommand = jest.spyOn(argv, 'demandCommand').mockReturnValue(argv);

    await cli.default(argv);

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
});
