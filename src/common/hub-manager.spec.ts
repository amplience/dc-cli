import HubManager from '../common/hub-manager';
import * as sdk from 'dc-management-sdk-js';
import * as configure from '../commands/configure';
import fs from 'fs-extra';

// eslint-disable-next-line
const enquirer = require('enquirer');

const DummyHub = {
  clientId: 'client-id',
  clientSecret: 'client-id',
  hubId: 'hub-id',
  name: 'dummy-hub'
};

jest.mock('dc-management-sdk-js', () => ({
  ...jest.requireActual('dc-management-sdk-js'),
  DynamicContent: jest.fn()
}));

jest.mock('enquirer', () => ({
  ...jest.requireActual('enquirer'),
  AutoComplete: jest.fn()
}));

describe('hub manager', function() {
  const hubGetMock = jest.fn();
  const autocompleteRun = jest.fn();
  let configureSpy: jest.SpyInstance;

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  afterAll((): void => {
    jest.resetAllMocks();
  });

  beforeEach((): void => {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(undefined);
    jest.spyOn(fs, 'mkdirpSync').mockReturnValueOnce(undefined);

    configureSpy = jest.spyOn(configure, 'handler').mockReturnValue();

    hubGetMock.mockReturnValue({
      name: 'dummy-hub'
    });

    autocompleteRun.mockResolvedValue(`${DummyHub.hubId} ${DummyHub.name}`);

    (sdk.DynamicContent as jest.Mock).mockReturnValue({
      hubs: {
        get: hubGetMock
      }
    });

    (enquirer.AutoComplete as jest.Mock).mockReturnValue({
      run: autocompleteRun
    });
  });

  const yargArgs = {
    $0: 'test',
    _: ['test']
  };

  const mockEmptyConfig = (repeats = 1): void => {
    const mock = jest.spyOn(fs, 'readJSONSync');

    for (let i = 0; i < repeats; i++) {
      mock.mockReturnValueOnce({}).mockReturnValueOnce([]);
    }
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
    mockEmptyConfig(2);

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

    expect(configureSpy).toHaveBeenCalled();
    expect(configureSpy.mock.calls[0][0].hubId).toEqual(DummyHub.hubId);
  });

  it('should fail to choose hub [foo]', async () => {
    mockDefaultConfig();
    await expect(HubManager.useHub({ ...yargArgs, hub: 'foo' })).rejects.toThrow(`hub configuration not found`);

    expect(configureSpy).not.toHaveBeenCalled();
  });

  it('should ask to choose a hub when none is provided and multiple are present', async () => {
    jest
      .spyOn(fs, 'readJSONSync')
      .mockReturnValueOnce(DummyHub)
      .mockReturnValueOnce([DummyHub, { ...DummyHub, hubId: 'hub-id2' }])
      .mockReturnValueOnce(DummyHub)
      .mockReturnValueOnce([DummyHub, { ...DummyHub, hubId: 'hub-id2' }]);

    await expect(HubManager.useHub({ ...yargArgs, hub: '' })).resolves.toBeDefined();

    expect(autocompleteRun).toHaveBeenCalledTimes(1);
    expect(configureSpy).toHaveBeenCalled();
    expect(configureSpy.mock.calls[0][0].hubId).toEqual(DummyHub.hubId);
  });

  it('should list hubs', async () => {
    jest
      .spyOn(fs, 'readJSONSync')
      .mockReturnValueOnce(DummyHub)
      .mockReturnValueOnce([{ ...DummyHub, isActive: true }, { ...DummyHub, hubId: 'hub-id2' }]);

    HubManager.listHubs();
  });
});
