import cli from './cli';
import Yargs from 'yargs/yargs';
import { configureCommandOptions } from './commands/configure';
import YargsCommandBuilderOptions from './common/yargs/yargs-command-builder-options';
import { basename } from 'path';

jest.mock('./commands/configure');

describe('cli', (): void => {
  it('should configure yarg instance', (): void => {
    const argv = Yargs(process.argv.slice(2));
    const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();
    const spyConfig = jest.spyOn(argv, 'config').mockReturnThis();
    const spyCommandDir = jest.spyOn(argv, 'commandDir').mockReturnThis();
    const spyDemandCommand = jest.spyOn(argv, 'demandCommand').mockReturnValue(argv);

    cli(argv);

    expect(spyOptions).toHaveBeenCalledWith(configureCommandOptions);
    expect(spyConfig).toHaveBeenCalledWith('config', expect.any(Function));
    expect(spyCommandDir).toHaveBeenCalledWith('./commands', YargsCommandBuilderOptions);
    expect(spyDemandCommand).toHaveBeenCalledWith(1, 'Please specify at least one command');
  });

  it('should create a yarg instance if one is not supplied', () => {
    configureCommandOptions.config.default = 'config.json';
    let buffer = '';
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation((output: string) => (buffer = `${buffer}${output}`));

    cli();

    // replace config file and script entry point
    buffer = buffer.replace(new RegExp(basename(process.argv[1]), 'g'), '<<ENTRYPOINT>>');

    expect(processExitSpy).toHaveBeenCalled();
    expect(buffer).toMatchSnapshot();
  });
});
