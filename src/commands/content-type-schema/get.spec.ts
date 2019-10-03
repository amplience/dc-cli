import { handler } from './get';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import DataPresenter from '../../view/data-presenter';
import { TableUserConfig } from 'table';
import { ContentTypeSchema } from 'dc-management-sdk-js';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('content-item-schema get command', () => {
  const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter<ContentTypeSchema>>;
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should get a content-item-schema', async () => {
    const yargArgs = {
      $0: 'test',
      _: ['test']
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    const mockGet = jest.fn();
    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      contentTypeSchemas: {
        get: mockGet
      }
    });
    const contentItemSchema = {
      id: 'content-type-schema-id'
    };
    const getResponse = {
      toJSON: (): { id: string } => {
        return contentItemSchema;
      }
    };
    mockGet.mockResolvedValue(getResponse);

    const argv = { ...yargArgs, id: 'content-type-schema-id', ...config };
    await handler(argv);

    const tableConfig: TableUserConfig = {
      columns: {
        1: {
          width: 100
        }
      }
    };
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, getResponse, tableConfig);
    expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalled();
  });
});
