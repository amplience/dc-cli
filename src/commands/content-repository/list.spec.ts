import { builder, command, handler, itemMapFn } from './list';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import DataPresenter, { RenderingOptions } from '../../view/data-presenter';
import { ContentRepository } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { DEFAULT_SIZE } from '../../common/dc-management-sdk-js/paginator';
import { SortingOptions } from '../../common/yargs/sorting-options';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('content-type-schema list command', (): void => {
  const mockDataPresenter = DataPresenter as jest.Mock;

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function() {
    expect(command).toEqual('list');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      expect(builder).toEqual({
        ...SortingOptions,
        ...RenderingOptions
      });
    });
  });

  describe('handler tests', function() {
    const yargArgs = {
      $0: 'test',
      _: ['test'],
      json: true
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    it('should pass the sort data into the service', async (): Promise<void> => {
      const pagingOptions = { sort: 'createdDate,desc' };

      const plainListContentRepository = [
        {
          id: '1',
          contentTypes: [
            {
              hubContentTypeId: 'id1',
              contentTypeUri: 'http://example.com/scheam1.json'
            }
          ],
          features: [],
          itemLocales: ['en', 'fr'],
          label: 'Inspiration',
          name: 'inspiration',
          status: 'ACTIVE',
          type: 'CONTENT'
        },
        {
          id: '2',
          contentTypes: [
            {
              hubContentTypeId: 'id2',
              contentTypeUri: 'http://example.com/scheam2.json'
            }
          ],
          features: ['slots'],
          itemLocales: ['en', 'fr'],
          label: 'Inspiration',
          name: 'inspiration',
          status: 'ACTIVE',
          type: 'CONTENT'
        }
      ];
      const listResponse = new MockPage(
        ContentRepository,
        plainListContentRepository.map(v => new ContentRepository(v))
      );
      const mockList = jest.fn().mockResolvedValue(listResponse);

      const mockGetHub = jest.fn().mockResolvedValue({
        related: {
          contentRepositories: {
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

      expect(mockGetHub).toBeCalledWith('hub-id');
      expect(mockList).toBeCalledWith({ size: DEFAULT_SIZE, ...pagingOptions });

      expect(mockDataPresenter).toHaveBeenCalledWith(plainListContentRepository);
      expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({ itemMapFn, json: argv.json });
    });

    it('should run the formatRow function', async (): Promise<void> => {
      const contentRepository = new ContentRepository({
        id: '1',
        contentTypes: [
          {
            hubContentTypeId: 'id2',
            contentTypeUri: 'http://example.com/scheam2.json'
          }
        ],
        features: ['slots'],
        itemLocales: ['en', 'fr'],
        label: 'Inspiration',
        name: 'inspiration',
        status: 'ACTIVE',
        type: 'CONTENT'
      });
      const result = itemMapFn(contentRepository.toJSON());
      expect(result).toEqual({
        contentTypes: 'id2, http://example.com/scheam2.json',
        features: 'slots',
        id: '1',
        itemLocales: ['en', 'fr'],
        label: 'Inspiration',
        name: 'inspiration',
        status: 'ACTIVE'
      });
    });
  });
});
