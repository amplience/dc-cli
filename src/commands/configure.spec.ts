import { CONFIG_FILENAME, handler, readConfigFile } from './configure';
import fs from 'fs';
import { join } from 'path';

describe('configure command', function() {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  afterAll((): void => {
    jest.resetAllMocks();
  });

  const yargArgs = {
    $0: 'test',
    _: ['test']
  };

  const configFixture = {
    clientId: 'client-id',
    clientSecret: 'client-id',
    hubId: 'hub-id'
  };

  it('should write a config file and create the .amplience dir', () => {
    jest
      .spyOn(fs, 'existsSync')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    jest.spyOn(fs, 'mkdirSync').mockReturnValueOnce(undefined);
    jest.spyOn(fs, 'writeFileSync').mockReturnValueOnce(undefined);

    handler({ ...yargArgs, ...configFixture, config: CONFIG_FILENAME() });

    expect(fs.existsSync).toHaveBeenCalledWith(expect.stringMatching(/\.amplience$/));
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringMatching(/\.amplience$/), { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp('.amplience/dc-cli-config.json$')),
      JSON.stringify(configFixture)
    );
  });

  it('should write the config file and re-used the .amplience dir', () => {
    jest
      .spyOn(fs, 'existsSync')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    jest.spyOn(fs, 'mkdirSync');
    jest.spyOn(fs, 'writeFileSync').mockReturnValueOnce(undefined);

    handler({ ...yargArgs, ...configFixture, config: CONFIG_FILENAME() });

    expect(fs.existsSync).toHaveBeenCalledWith(expect.stringMatching(/\.amplience$/));
    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp('.amplience/dc-cli-config.json$')),
      JSON.stringify(configFixture)
    );
  });

  it('should write a config file and use the specified file', () => {
    jest
      .spyOn(fs, 'existsSync')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    jest.spyOn(fs, 'mkdirSync').mockReturnValueOnce(undefined);
    jest.spyOn(fs, 'writeFileSync').mockReturnValueOnce(undefined);

    handler({ ...yargArgs, ...configFixture, config: 'subdirectory/custom-config.json' });

    expect(fs.existsSync).toHaveBeenCalledWith(expect.stringMatching(/subdirectory$/));
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringMatching(/subdirectory$/), { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp('subdirectory/custom-config.json$')),
      JSON.stringify(configFixture)
    );
  });

  it('should report an error if its not possible to create the .amplience dir', () => {
    jest
      .spyOn(fs, 'existsSync')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('Mock error');
    });
    jest.spyOn(fs, 'writeFileSync').mockReturnValueOnce(undefined);

    expect(() => {
      handler({ ...yargArgs, ...configFixture, config: CONFIG_FILENAME() });
    }).toThrowError(/^Unable to create dir ".*". Reason: .*/);

    expect(fs.existsSync).toHaveBeenCalledWith(expect.stringMatching(/\.amplience$/));
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringMatching(/\.amplience$/), { recursive: true });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should report an error if its not possible to create/write the config file', () => {
    jest
      .spyOn(fs, 'existsSync')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    jest.spyOn(fs, 'mkdirSync');
    jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw new Error('Mock Error');
    });

    expect(() => {
      handler({ ...yargArgs, ...configFixture, config: CONFIG_FILENAME() });
    }).toThrowError(/^Unable to write config file ".*". Reason: .*/);

    expect(fs.existsSync).toHaveBeenCalledWith(expect.stringMatching(/\.amplience$/));
    expect(fs.mkdirSync).not.toHaveBeenCalledWith();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp('.amplience/dc-cli-config.json$')),
      JSON.stringify(configFixture)
    );
  });

  it('should not write the config file if no changes detected', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify(configFixture));
    jest.spyOn(fs, 'writeFileSync');

    handler({ ...yargArgs, ...configFixture, config: CONFIG_FILENAME() });

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should read config file if its present', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(configFixture));

    const configFile = 'config.json';
    const result = readConfigFile(configFile);
    expect(result).toEqual(configFixture);
    expect(fs.existsSync).toHaveBeenCalledWith(configFile);
    expect(fs.readFileSync).toHaveBeenCalledWith(configFile, 'utf-8');
  });

  it('should not read config file is not present', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{}');

    const configFile = 'config.json';
    const result = readConfigFile(configFile);
    expect(result).toEqual({});
    expect(fs.existsSync).toHaveBeenCalledWith(configFile);
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('should use USERPROFILE env var for win32', () => {
    process.env.USERPROFILE = 'USERPROFILE';
    expect(CONFIG_FILENAME('win32')).toEqual(join('USERPROFILE/.amplience/dc-cli-config.json'));
  });

  it('should use HOME env var for everything else', () => {
    process.env.HOME = 'HOME';
    expect(CONFIG_FILENAME('macos')).toEqual(join('HOME/.amplience/dc-cli-config.json'));
  });

  it('should use current dir if HOME is not defined', () => {
    delete process.env.HOME;
    expect(CONFIG_FILENAME('macos')).toEqual(join(`${__dirname}/.amplience/dc-cli-config.json`));
  });
});
