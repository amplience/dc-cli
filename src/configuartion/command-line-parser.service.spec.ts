import { CommandLineParserService, GLOBALCONFIG_FILENAME } from './command-line-parser.service';
import { join } from 'path';
import * as fs from 'fs';

describe('command line parser service', (): void => {
  let processExitSpy: jest.SpyInstance;
  let commandLineParserService: CommandLineParserService;

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
    expect(processExitSpy).toHaveBeenCalledTimes(0);
  });

  it('can save global params into config file', (): void => {
    if (fs.existsSync(GLOBALCONFIG_FILENAME)) {
      fs.unlinkSync(GLOBALCONFIG_FILENAME);
    }
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
    expect(fs.existsSync(GLOBALCONFIG_FILENAME)).toEqual(true);
    expect(processExitSpy).toHaveBeenCalledTimes(0);
  });

  it('can use global params saved in config file', (): void => {
    const result = commandLineParserService.parse([
      '--config',
      join(__dirname, 'fixtures', 'dc-cli-global.config.json')
    ]);
    expect(result.hub).toEqual('test_config_hub');
    expect(result.key).toEqual('test_config_key');
    expect(result.secret).toEqual('test_config_secret');
    expect(processExitSpy).toHaveBeenCalledTimes(0);
  });

  it('can override params in config file by specifying in another config file', (): void => {
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
    expect(processExitSpy).toHaveBeenCalledTimes(0);
  });
});
