import { handler } from './list';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import DataPresenter from '../../view/data-presenter';
import { ContentTypeSchema, Page } from 'dc-management-sdk-js';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

xdescribe('content-item-schema list command', (): void => {
  const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter<Page<ContentTypeSchema>>>;

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  xit("should list a hubs content-item-schema's", async (): Promise<void> => {
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

    (mockDataPresenter as jest.Mock).mockReturnValue(
      jest.fn(() => ({
        parse: 'pop'
      }))
    );

    const argv = { ...yargArgs, ...config };
    await handler(argv);

    expect(mockDataPresenter).toHaveBeenCalledWith(argv, listResponse);
    expect(mockDataPresenter.mock.instances[0].parse).toHaveBeenCalled();
    expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalled();
  });
});
