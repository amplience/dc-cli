import { LinkedContentRepository } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { handler } from './create';
import DataPresenter from '../../view/data-presenter';
import { singleItemTableOptions } from '../../common/table/table.consts';
import { jsonResolver } from '../../common/json-resolver/json-resolver';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');
jest.mock('../../common/json-resolver/json-resolver');

describe('linked-content-repository', () => {
  const mockDataPresenter = DataPresenter as jest.Mock;

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should create a linked content respository', async () => {
    const yargArgs = {
      $0: 'test',
      _: ['test'],
      json: true
    };
    const config = {
      patToken: 'patToken',
      hubId: 'hub-id'
    };
    const linkedContentRepositoryPayload = {
      originHubId: '67a4c79111e8f0513ce243ac',
      hubIds: ['67a4c79111e8f0513ce243ac', '68932ed38f35681e4d3eac61'],
      originHubLabel: 'Development Hub A',
      destinationHubLabel: 'Development Hub B',
      bidirectional: false,
      relationships: [
        {
          originRepositoryId: '67a4c7ad11e8f0513ce243ad',
          originRepositoryLabel: 'Repo A',
          dstRepositoryId: '68932f2d8f35681e4d3eac62',
          dstRepositoryLabel: 'Repo B'
        }
      ]
    };

    const mockCreate = jest.fn().mockResolvedValue(new LinkedContentRepository(linkedContentRepositoryPayload));

    const mockGetHub = jest.fn().mockResolvedValue({
      related: {
        linkedContentRepositories: {
          create: mockCreate
        }
      }
    });

    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      hubs: {
        get: mockGetHub
      }
    });

    (jsonResolver as jest.Mock).mockReturnValue(JSON.stringify(linkedContentRepositoryPayload));

    const argv = { ...yargArgs, ...config, file: './path/to/file.json' };
    await handler(argv);

    expect(mockGetHub).toHaveBeenCalledWith('hub-id');
    expect(mockCreate).toHaveBeenCalledWith(linkedContentRepositoryPayload);

    expect(mockDataPresenter).toHaveBeenCalledWith(linkedContentRepositoryPayload);
    expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({
      json: argv.json,
      tableUserConfig: singleItemTableOptions
    });
  });
});
