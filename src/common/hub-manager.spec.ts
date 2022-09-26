import HubManager from '../common/hub-manager';
import * as sdk from 'dc-management-sdk-js';
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

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  afterAll((): void => {
    jest.resetAllMocks();
  });

  beforeEach((): void => {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(undefined);
    jest.spyOn(fs, 'mkdirpSync').mockReturnValueOnce(undefined);

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

  it('should ask to choose a hub when none is provided and multiple are present', async () => {
    jest
      .spyOn(fs, 'readJSONSync')
      .mockReturnValueOnce(DummyHub)
      .mockReturnValueOnce([DummyHub, { ...DummyHub, hubId: 'hub-id2' }])
      .mockReturnValueOnce(DummyHub)
      .mockReturnValueOnce([DummyHub, { ...DummyHub, hubId: 'hub-id2' }]);

    await expect(HubManager.useHub({ ...yargArgs, hub: '' })).resolves.toBeDefined();

    expect(autocompleteRun).toHaveBeenCalledTimes(1);
  });

  it('should list hubs', async () => {
    jest
      .spyOn(fs, 'readJSONSync')
      .mockReturnValueOnce(DummyHub)
      .mockReturnValueOnce([{ ...DummyHub, isActive: true }, { ...DummyHub, hubId: 'hub-id2' }]);

    HubManager.listHubs();
  });
});
