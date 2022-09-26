import HubManager, { DummyHub } from '../common/hub-manager';
import fs from 'fs-extra';

// jest.mock('../common/hub-manager');
// const { addHub } = jest.requireActual('../common/hub-manager');

describe('hub manager', function() {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  afterAll((): void => {
    jest.resetAllMocks();
  });

  beforeEach((): void => {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(undefined);
    jest.spyOn(fs, 'mkdirpSync').mockReturnValueOnce(undefined);
  });

  const yargArgs = {
    $0: 'test',
    _: ['test']
  };

  const mockEmptyConfig = (): void => {
    jest
      .spyOn(fs, 'readJSONSync')
      .mockReturnValueOnce({})
      .mockReturnValueOnce([]);
  };

  const mockDefaultConfig = (): void => {
    jest
      .spyOn(fs, 'readJSONSync')
      .mockReturnValueOnce(DummyHub)
      .mockReturnValueOnce([DummyHub]);
  };

  it('should create an empty json file if getHubs is called before any are entered', async () => {
    mockEmptyConfig();

    const mockedWriteFileSync = jest.spyOn(fs, 'writeFileSync');
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
    HubManager.getHubs();
    expect(mockedWriteFileSync).toHaveBeenCalled();
  });

  it('should NOT overwrite hubs.json if it exists already', async () => {
    mockEmptyConfig();

    const mockedWriteFileSync = jest.spyOn(fs, 'writeFileSync');
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
    HubManager.getHubs();
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });

  it('should save hub', async () => {
    mockEmptyConfig();

    const mockedWriteFileSync = jest.spyOn(fs, 'writeFileSync');
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
    await HubManager.addHub({ ...yargArgs, ...DummyHub });
    expect(mockedWriteFileSync).toHaveBeenCalled();
  });

  it('should fail to save a duplicate hub', async () => {
    mockDefaultConfig();

    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
    await expect(HubManager.addHub({ ...yargArgs, ...DummyHub })).rejects.toThrow(`config already exists`);
  });

  it('should choose the dummy hub', async () => {
    mockDefaultConfig();
    await expect(HubManager.useHub({ ...yargArgs, hub: DummyHub.name })).resolves.toBeDefined();
  });

  it('should fail to choose hub [foo]', async () => {
    mockDefaultConfig();
    await expect(HubManager.useHub({ ...yargArgs, hub: 'foo' })).rejects.toThrow(`hub configuration not found`);
  });

  it('should list hubs', async () => {
    mockDefaultConfig();
    HubManager.listHubs();
  });
});
