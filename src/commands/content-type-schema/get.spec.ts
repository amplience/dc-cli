import { handler } from './get';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { renderData } from '../../view/data-presenter';
import { TableUserConfig } from 'table';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('content-item-schema get command', () => {
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
    mockGet.mockResolvedValue({
      toJson: () => {
        return contentItemSchema;
      }
    });

    const argv = { ...yargArgs, id: 'content-type-schema-id', ...config };
    await handler(argv);

    const expectedUserConfig: TableUserConfig = {
      columns: {
        1: {
          width: 100
        }
      }
    };
    expect(renderData).toHaveBeenCalledWith(argv, contentItemSchema, expectedUserConfig);
  });
});
