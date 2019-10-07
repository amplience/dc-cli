import CommandLineParserService, { GLOBALCONFIG_FILENAME } from './command-line-parser.service';
import * as fs from 'fs';

describe('command line parser service', (): void => {
  let processExitSpy: jest.SpyInstance;
  let commandLineParserService: CommandLineParserService;

  const TEST_GLOBAL_CONFIG = {
    hub: 'test_config_hub',
    key: 'test_config_key',
    secret: 'test_config_secret'
  };

  beforeEach((): void => {
    commandLineParserService = new CommandLineParserService();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  afterAll((): void => {
    jest.resetAllMocks();
  });

  it('can pass global params on command line', (): void => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
    jest.spyOn(fs, 'readFileSync');
    const result = commandLineParserService.parse([
      '--hub',
      '123456789',
      '--key',
      'abcdefghijk',
      '--secret',
      'qwertyuiop'
    ]);
    expect(result.hub).toEqual('123456789');
    expect(result.key).toEqual('abcdefghijk');
    expect(result.secret).toEqual('qwertyuiop');
    expect(fs.readFileSync).not.toHaveBeenCalledWith(GLOBALCONFIG_FILENAME, expect.anything(), expect.anything());
    expect(processExitSpy).toHaveBeenCalledTimes(0);
  });

  it('all global params must be passed on command line if no config file exists', (): void => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
    jest.spyOn(fs, 'readFileSync');
    jest.spyOn(console, 'error');
    commandLineParserService.parse(['--hub', '123456789', '--key', 'abcdefghijk']);
    expect(fs.readFileSync).not.toHaveBeenCalledWith(GLOBALCONFIG_FILENAME, expect.anything(), expect.anything());
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching('Missing required argument: secret'));
    expect(processExitSpy).toHaveBeenCalledTimes(1);
  });

  it('can save params to config file', (): void => {
    jest.spyOn(fs, 'writeFile');
    jest.spyOn(commandLineParserService, 'storeGlobal');
    const result = commandLineParserService.parse([
      'configure',
      '--hub',
      'test_config_hub',
      '--key',
      'test_config_key',
      '--secret',
      'test_config_secret'
    ]);
    expect(result.hub).toEqual('test_config_hub');
    expect(result.key).toEqual('test_config_key');
    expect(result.secret).toEqual('test_config_secret');
    expect(commandLineParserService.storeGlobal).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledWith(
      GLOBALCONFIG_FILENAME,
      JSON.stringify(TEST_GLOBAL_CONFIG),
      expect.any(Function)
    );
    expect(processExitSpy).toHaveBeenCalledTimes(0);
  });

  it('will load params from config file if one exists', (): void => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(TEST_GLOBAL_CONFIG));
    const result = new CommandLineParserService().parse();
    expect(result.hub).toEqual('test_config_hub');
    expect(result.key).toEqual('test_config_key');
    expect(result.secret).toEqual('test_config_secret');
    expect(fs.readFileSync).toHaveBeenCalledWith(GLOBALCONFIG_FILENAME, 'utf-8');
    expect(fs.readFileSync).toHaveReturnedWith(JSON.stringify(TEST_GLOBAL_CONFIG));
    expect(processExitSpy).toHaveBeenCalledTimes(0);
  });

  it('can override params in config by specifying on command line', (): void => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(TEST_GLOBAL_CONFIG));
    const result = commandLineParserService.parse(['--hub', '123456789']);
    expect(result.hub).toEqual('123456789');
    expect(result.key).toEqual('test_config_key');
    expect(result.secret).toEqual('test_config_secret');
    expect(fs.readFileSync).toHaveBeenCalledWith(GLOBALCONFIG_FILENAME, 'utf-8');
    expect(fs.readFileSync).toHaveReturnedWith(JSON.stringify(TEST_GLOBAL_CONFIG));
    expect(processExitSpy).toHaveBeenCalledTimes(0);
  });
});
