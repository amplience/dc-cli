import { Arguments } from 'yargs';
import { FileLog } from '../../../common/file-log';
import { CleanHubBuilderOptions } from '../../../interfaces/clean-hub-builder-options';
import { ConfigurationParameters } from '../../configure';
import { join } from 'path';

import * as archive from '../../content-item/archive';

import { ContentCleanStep } from './content-clean-step';

jest.mock('../../../services/dynamic-content-client-factory');
jest.mock('../../content-item/archive');

describe('content clean step', () => {
  const yargArgs = {
    $0: 'test',
    _: ['test']
  };

  const config = {
    clientId: 'client-id',
    clientSecret: 'client-id',
    hubId: 'hub-id'
  };

  function reset(): void {
    jest.resetAllMocks();
  }

  beforeEach(async () => {
    reset();
  });

  function generateState(
    directory: string,
    logName: string
  ): Arguments<CleanHubBuilderOptions & ConfigurationParameters> {
    return {
      ...yargArgs,
      ...config,

      logFile: new FileLog(join(directory, logName + '.log'))
    };
  }

  it('should have the name "Clean Content"', () => {
    const step = new ContentCleanStep();
    expect(step.getName()).toEqual('Clean Content');
  });

  it('should call the copy command with arguments from the state', async () => {
    const argv = generateState('temp/clean-content/run/', 'run');

    (archive.handler as jest.Mock).mockResolvedValue(true);

    const step = new ContentCleanStep();
    const result = await step.run(argv);

    expect(archive.handler).toHaveBeenCalledWith({
      ...argv
    });

    expect(result).toBeTruthy();
  });

  it('should return false when the copy command fails', async () => {
    const argv = generateState('temp/clean-content/fail/', 'fail');

    (archive.handler as jest.Mock).mockRejectedValue(false);

    const step = new ContentCleanStep();
    const result = await step.run(argv);

    expect(archive.handler).toHaveBeenCalled();
    expect(result).toBeFalsy();
  });
});
