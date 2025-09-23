import { LinkedContentRepository } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { handler, itemMapFn } from './list';
import { DEFAULT_SIZE } from '../../common/dc-management-sdk-js/paginator';
import DataPresenter from '../../view/data-presenter';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('linked-content-repository', () => {
  const mockDataPresenter = DataPresenter as jest.Mock;

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should list linked content respositories', async () => {
    const yargArgs = {
      $0: 'test',
      _: ['test'],
      json: true
    };
    const config = {
      patToken: 'patToken',
      hubId: 'hub-id'
    };
    const pagingOptions = { sort: 'createdDate,desc' };
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
    const linkedContentRepositoryResponse = [new LinkedContentRepository(linkedContentRepositoryPayload)];

    const listResponse = new MockPage(LinkedContentRepository, linkedContentRepositoryResponse);
    const mockList = jest.fn().mockResolvedValue(listResponse);

    const mockGetHub = jest.fn().mockResolvedValue({
      related: {
        linkedContentRepositories: {
          list: mockList
        }
      }
    });

    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      hubs: {
        get: mockGetHub
      }
    });

    const argv = { ...yargArgs, ...config, ...pagingOptions };
    await handler(argv);

    expect(mockGetHub).toHaveBeenCalledWith('hub-id');
    expect(mockList).toHaveBeenCalledWith({ size: DEFAULT_SIZE, ...pagingOptions });

    expect(mockDataPresenter).toHaveBeenCalledWith([linkedContentRepositoryPayload]);
    expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({ json: argv.json, itemMapFn });
  });

  describe('itemMapFn', function () {
    it('should render response view', function () {
      const result = itemMapFn(
        new LinkedContentRepository({
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
        })
      );
      expect(result).toEqual({
        bidirectional: false,
        hubIds: ['67a4c79111e8f0513ce243ac', '68932ed38f35681e4d3eac61'],
        originHubId: '67a4c79111e8f0513ce243ac',
        originHubLabel: 'Development Hub A'
      });
    });
  });
});
