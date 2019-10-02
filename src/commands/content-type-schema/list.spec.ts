import { handler } from './list';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import DataPresenter from '../../view/data-presenter';
import { ContentTypeSchema, Page } from 'dc-management-sdk-js';

jest.mock('../../services/dynamic-content-client-factory');

const mockParse = jest.fn();
const mockRender = jest.fn();
jest.mock('../../view/data-presenter', () => {
  return jest.fn(() => ({
    parse: mockParse.mockImplementation(() => ({
      render: mockRender
    }))
  }));
});
const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter<Page<ContentTypeSchema>>>;

describe('content-item-schema list command', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should list a hubs content-item-schema', async (): Promise<void> => {
    const yargArgs = {
      $0: 'test',
      _: ['test']
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    const contentTypeSchemaResponse = [
      {
        id: 'abc-123-def'
      }
    ];

    const listResponse = {
      toJson: (): { id: string }[] => {
        return contentTypeSchemaResponse;
      },
      getItems: (): { id: string }[] => contentTypeSchemaResponse
    };
    const mockList = jest.fn().mockResolvedValue(listResponse);

    const mockGetHub = jest.fn().mockResolvedValue({
      related: {
        contentTypeSchema: {
          list: mockList
        }
      }
    });

    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      hubs: {
        get: mockGetHub
      }
    });

    const argv = { ...yargArgs, ...config };
    await handler(argv);

    expect(mockDataPresenter).toHaveBeenCalledWith(argv, listResponse);
    expect(mockParse).toHaveBeenCalled();
    expect(mockRender).toHaveBeenCalled();
  });
});
