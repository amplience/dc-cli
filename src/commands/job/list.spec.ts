import { command, handler, itemMapFn } from './list';
import DataPresenter from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Job } from 'dc-management-sdk-js';
import { DEFAULT_SIZE } from '../../common/dc-management-sdk-js/paginator';
import MockPage from '../../common/dc-management-sdk-js/mock-page';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('job list command', () => {
  it('should command should defined', function () {
    expect(command).toEqual('list');
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
      hubId: '67d1c1c7642fa239dbe15164'
    };
    it('should list jobs', async () => {
      const pagingOptions = { sort: 'createdDate,desc' };
      const listResponse = new MockPage(Job, [
        new Job({ id: '68e5289f0aba3024bde00001' }),
        new Job({ id: '68e5289f0aba3024bde00002' })
      ]);
      const mockListJobs = jest.fn().mockResolvedValue(listResponse);
      const mockGetHub = jest.fn().mockResolvedValue({
        related: {
          jobs: {
            list: mockListJobs
          }
        }
      });
      const mockDataPresenter = DataPresenter as jest.Mock;

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });

      const argv = { ...yargArgs, ...config, ...pagingOptions };
      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('67d1c1c7642fa239dbe15164');
      expect(mockListJobs).toHaveBeenCalledWith({ size: DEFAULT_SIZE, ...pagingOptions });

      expect(mockDataPresenter).toHaveBeenCalledWith([
        { id: '68e5289f0aba3024bde00001' },
        { id: '68e5289f0aba3024bde00002' }
      ]);
      expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({ itemMapFn, json: argv.json });
    });
  });
});
