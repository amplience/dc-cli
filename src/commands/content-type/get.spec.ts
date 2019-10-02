import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { handler } from './get';
import { TableUserConfig } from 'table';
import DataPresenter from '../../view/data-presenter';
import { ContentType } from 'dc-management-sdk-js';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('ContentType.get', () => {
  const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter<ContentType>>;
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should return a content type', async () => {
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
      contentTypes: {
        get: mockGet
      }
    });
    const contentType = {
      id: 'content-type-id'
    };
    const getResponse = {
      toJson: (): { id: string } => {
        return contentType;
      }
    };
    mockGet.mockResolvedValue(getResponse);

    const argv = { ...yargArgs, id: 'content-type-id', ...config };
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
