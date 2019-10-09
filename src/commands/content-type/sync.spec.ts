import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { builder, command, handler } from './sync';
import DataPresenter, { RenderingOptions } from '../../view/data-presenter';
import { ContentTypeCachedSchema } from 'dc-management-sdk-js';
import { singleItemTableOptions } from '../../common/table/table.consts';
import Yargs from 'yargs/yargs';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('ContentType.sync', () => {
  const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter>;

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

  afterEach((): void => {
    jest.restoreAllMocks();
  });
  it('should command should defined', function() {
    expect(command).toEqual('sync <id>');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        describe: 'Content Type ID',
        type: 'string'
      });
      expect(spyOptions).toHaveBeenCalledWith(RenderingOptions);
    });
  });

  describe('handler tests', function() {
    it('should sync a content type with the schema', async () => {
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

      const plainContentTypeCachedSchema = {
        id: 'content-type-cached-schema-id'
      };

      mockGet.mockResolvedValue(contentType);
      mockUpdate.mockResolvedValue(new ContentTypeCachedSchema(plainContentTypeCachedSchema));

      const argv = { ...yargArgs, id: 'content-type-id', ...config };
      await handler(argv);

      expect(mockDataPresenter).toHaveBeenCalledWith(plainContentTypeCachedSchema);
      expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({
        json: argv.json,
        tableUserConfig: singleItemTableOptions
      });
    });
  });
});
