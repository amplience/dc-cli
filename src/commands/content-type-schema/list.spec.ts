import { handler, itemMapFn } from './list';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import DataPresenter from '../../view/data-presenter';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('content-type-schema list command', (): void => {
  const mockDataPresenter = DataPresenter as jest.Mock;

  afterEach((): void => {
    jest.restoreAllMocks();
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

    it('should page the data', async (): Promise<void> => {
      const pagingOptions = { page: 3, size: 10, sort: 'createdDate,desc' };

      const plainListContentTypeSchemas = [
        {
          id: '1',
          body: '{}',
          schemaId: 'schemaId1'
        },
        {
          id: '2',
          body: '{}',
          schemaId: 'schemaId2'
        }
      ];
      const contentTypeSchemaResponse: ContentTypeSchema[] = plainListContentTypeSchemas.map(
        v => new ContentTypeSchema(v)
      );

      const listResponse = new MockPage(ContentTypeSchema, contentTypeSchemaResponse);
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

      const argv = { ...yargArgs, ...config, ...pagingOptions };
      await handler(argv);

      expect(mockGetHub).toBeCalledWith('hub-id');
      expect(mockList).toBeCalledWith(pagingOptions);

      expect(mockDataPresenter).toHaveBeenCalledWith(plainListContentTypeSchemas);
      expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({ itemMapFn, json: argv.json });
    });

    it('should run the formatRow function', async (): Promise<void> => {
      const contentTypeSchema = new ContentTypeSchema({
        id: 'id',
        schemaId: 'schemaId',
        version: 'version',
        validationLevel: 'validationLevel',
        body: '{}'
      });
      const result = itemMapFn(contentTypeSchema.toJson());
      expect(result).toEqual({
        id: 'id',
        schemaId: 'schemaId',
        validationLevel: 'validationLevel',
        version: 'version'
      });
    });
  });
});
