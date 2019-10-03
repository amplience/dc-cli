import { handler, itemMapFn } from './list';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import DataPresenter from '../../view/data-presenter';
import { ContentType } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('content-type list command', (): void => {
  const mockDataPresenter = DataPresenter as jest.Mock;

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should page the data', async (): Promise<void> => {
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

    const pagingOptions = { page: 3, size: 10, sort: 'createdDate,desc' };

    const plainListContentTypes = [
      {
        id: '1',
        contentTypeUri: '{}',
        settings: {
          label: 'label 1'
        }
      },
      {
        id: '2',
        contentTypeUri: '{}',
        settings: {
          label: 'label 1'
        }
      }
    ];
    const contentTypeResponse: ContentType[] = plainListContentTypes.map(v => new ContentType(v));

    const listResponse = new MockPage(ContentType, contentTypeResponse);
    const mockList = jest.fn().mockResolvedValue(listResponse);

    const mockGetHub = jest.fn().mockResolvedValue({
      related: {
        contentTypes: {
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
    expect(mockList).toBeCalledWith(pagingOptions);

    expect(mockDataPresenter).toHaveBeenCalledWith(plainListContentTypes);
    expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({ json: argv.json, itemMapFn });
  });

  describe('itemMapFn tests', function() {
    it('should render settings.label', function() {
      const result = itemMapFn(
        new ContentType({
          id: 'id',
          contentTypeUri: 'contentTypeUri',
          settings: {
            label: 'label'
          },
          icons: {
            size: 256,
            url: 'http://example.com'
          }
        })
      );
      expect(result).toEqual({
        id: 'id',
        label: 'label',
        contentTypeUri: 'contentTypeUri'
      });
    });

    it('should default settings.label to empty string', function() {
      const result = itemMapFn(
        new ContentType({
          id: 'id',
          contentTypeUri: 'contentTypeUri'
        })
      );
      expect(result).toEqual({
        id: 'id',
        label: '',
        contentTypeUri: 'contentTypeUri'
      });
    });
  });
});
