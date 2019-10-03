import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { handler } from './sync';
import { TableUserConfig } from 'table';
import DataPresenter from '../../view/data-presenter';
import { ContentType } from 'dc-management-sdk-js';
import * as cachedContentTypeFixture from './__fixtures/content-type-cached-schema.json';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('ContentType.sync', () => {
  const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter<ContentType>>;
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should sync a content type with the schema', async () => {
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
    const mockUpdate = jest.fn();
    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      contentTypes: {
        get: mockGet
      }
    });

    const contentType = {
      related: {
        contentTypeSchema: {
          update: mockUpdate
        }
      }
    };

    const contentTypeCachedSchema = {
      id: 'content-type-cached-schema-id'
    };

    mockGet.mockResolvedValue(contentType);
    mockUpdate.mockResolvedValue(contentTypeCachedSchema);

    const argv = { ...yargArgs, id: 'content-type-id', ...config };
    await handler(argv);

    const tableConfig: TableUserConfig = {
      columns: {
        1: {
          width: 100
        }
      }
    };
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, contentTypeCachedSchema, tableConfig);
    expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalled();
  });
});
