import Yargs from 'yargs/yargs';
import { builder, command, handler } from './get';
import DataPresenter, { RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Hub, Job } from 'dc-management-sdk-js';
import { singleItemTableOptions } from '../../common/table/table.consts';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('job get command', () => {
  it('should command should defined', function () {
    expect(command).toEqual('get <id>');
  });

  describe('builder', () => {
    it('should configure command arguments', function () {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        describe: 'Job ID',
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
      clientSecret: 'client-secret',
      hubId: '67d1c1c7642fa239dbe15164'
    };

    it('should get a job by id', async () => {
      const mockDataPresenter = DataPresenter as jest.Mock;
      const mockGetHub = jest.fn();
      const mockGetJob = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub.mockResolvedValue({
            ...new Hub({ id: '67d1c1c7642fa239dbe15164' }),
            related: { jobs: { get: mockGetJob.mockResolvedValue(new Job({ id: '68e5289f0aba3024bde050f9' })) } }
          })
        }
      });
      const argv = { ...yargArgs, id: '68e5289f0aba3024bde050f9', ...config };

      await handler(argv);

      expect(mockGetHub).toHaveBeenCalledWith('67d1c1c7642fa239dbe15164');
      expect(mockGetJob).toHaveBeenCalledWith('68e5289f0aba3024bde050f9');
      expect(mockDataPresenter).toHaveBeenCalledWith({ id: '68e5289f0aba3024bde050f9' });
      expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({
        json: argv.json,
        tableUserConfig: singleItemTableOptions
      });
    });
  });
});
