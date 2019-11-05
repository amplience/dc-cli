import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { builder, command, handler } from './unassign-content-type';
import DataPresenter, { RenderingOptions } from '../../view/data-presenter';
import { ContentRepository } from 'dc-management-sdk-js';
import { singleItemTableOptions } from '../../common/table/table.consts';
import Yargs from 'yargs/yargs';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('content-repository assign-content-type command', () => {
  const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter>;

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should have a command defined', function() {
    expect(command).toEqual('unassign-content-type [id]');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();

      const options = {
        contentTypeId: {
          type: 'string',
          demandOption: true,
          description: 'content-type ID to unassign'
        },
        ...RenderingOptions
      };

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        demandOption: true,
        describe: 'Content Repository ID',
        type: 'string'
      });
      expect(spyOptions).toHaveBeenCalledWith(options);
    });
  });

  describe('handler tests', function() {
    const yargArgs = {
      $0: 'test',
      _: ['test'],
      json: true,
      contentTypeId: 'content-type-id'
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    it('should return a content repository', async () => {
      const mockGet = jest.fn();
      const mockUnassign = jest.fn();
      const mockToJSON = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentRepositories: {
          get: mockGet
        }
      });
      mockGet.mockResolvedValue({
        related: {
          contentTypes: {
            unassign: mockUnassign
          }
        },
        toJSON: mockToJSON
      });

      const contentRepository = new ContentRepository({
        contentTypes: []
      });
      mockUnassign.mockResolvedValue(undefined);
      mockToJSON.mockReturnValue(contentRepository.toJSON());

      const argv = { ...yargArgs, id: 'content-type-id', ...config };
      await handler(argv);

      expect(mockToJSON).toHaveBeenCalled();
      expect(mockDataPresenter).toHaveBeenCalledWith(contentRepository.toJSON());
      expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({
        json: argv.json,
        tableUserConfig: singleItemTableOptions
      });
    });
  });
});