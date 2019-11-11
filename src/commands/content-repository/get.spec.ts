import DataPresenter, { RenderingOptions } from '../../view/data-presenter';
import { command, builder, handler } from './get';
import Yargs = require('yargs/yargs');
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentRepository } from 'dc-management-sdk-js';
import { singleItemTableOptions } from '../../common/table/table.consts';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('content-repostories get command', () => {
  const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter>;

  afterEach((): void => {
    jest.restoreAllMocks();
  });
  it('should have a get command defined', () => {
    expect(command).toEqual('get <id>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        describe: 'Content Repository ID',
        type: 'string'
      });
      expect(spyOptions).toHaveBeenCalledWith(RenderingOptions);
    });
  });

  describe('handler', () => {
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

    it('should return a content repository', async () => {
      const mockGet = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentRepositories: {
          get: mockGet
        }
      });
      const plainContentRepository = {
        id: 'content-repository-id'
      };
      const getResponse = new ContentRepository(plainContentRepository);
      mockGet.mockResolvedValue(getResponse);

      const argv = { ...yargArgs, id: 'content-repository-id', ...config };
      await handler(argv);

      expect(mockDataPresenter).toHaveBeenCalledWith(plainContentRepository);
      expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({
        json: argv.json,
        tableUserConfig: singleItemTableOptions
      });
    });
  });
});
