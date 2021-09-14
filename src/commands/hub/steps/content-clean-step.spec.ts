import { Arguments } from 'yargs';
import { FileLog } from '../../../common/file-log';
import { CleanHubBuilderOptions } from '../../../interfaces/clean-hub-builder-options';
import { ConfigurationParameters } from '../../configure';
import { join } from 'path';

import * as archive from '../../content-item/archive';

import { ContentCleanStep } from './content-clean-step';
import { CleanHubStepId } from '../model/clean-hub-step';

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

  it('should have the id "content"', () => {
    const step = new ContentCleanStep();
    expect(step.getId()).toEqual(CleanHubStepId.Content);
  });

  it('should have the name "Clean Content"', () => {
    const step = new ContentCleanStep();
    expect(step.getName()).toEqual('Clean Content');
  });

  it('should call the copy command with arguments from the state', async () => {
    const argv = generateState(`temp_${process.env.JEST_WORKER_ID}/clean-content/run/`, 'run');

    (archive.handler as jest.Mock).mockResolvedValue(true);

    const step = new ContentCleanStep();
    const result = await step.run(argv);

    expect(archive.handler).toHaveBeenCalledWith({
      ...argv
    });

    expect(result).toBeTruthy();
  });

  it('should return false when the copy command fails', async () => {
    const argv = generateState(`temp_${process.env.JEST_WORKER_ID}/clean-content/fail/`, 'fail');

    (archive.handler as jest.Mock).mockRejectedValue(false);

    const step = new ContentCleanStep();
    const result = await step.run(argv);

    expect(archive.handler).toHaveBeenCalled();
    expect(result).toBeFalsy();
  });
});
