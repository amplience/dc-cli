import { Arguments } from 'yargs';
import { FileLog } from '../../../common/file-log';
import { CleanHubBuilderOptions } from '../../../interfaces/clean-hub-builder-options';
import { ConfigurationParameters } from '../../configure';
import { join } from 'path';

import * as archive from '../../content-type/archive';

import { TypeCleanStep } from './type-clean-step';

jest.mock('../../../services/dynamic-content-client-factory');
jest.mock('../../content-type/archive');

describe('type clean step', () => {
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

  it('should have the name "Clean Content Types"', () => {
    const step = new TypeCleanStep();
    expect(step.getName()).toEqual('Clean Content Types');
  });

  it('should call the copy command with arguments from the state', async () => {
    const argv = generateState('temp/clean-schema/run/', 'run');

    (archive.handler as jest.Mock).mockResolvedValue(true);

    const step = new TypeCleanStep();
    const result = await step.run(argv);

    expect(archive.handler).toHaveBeenCalledWith({
      ...argv
    });

    expect(result).toBeTruthy();
  });

  it('should return false when the copy command fails', async () => {
    const argv = generateState('temp/clean-schema/fail/', 'fail');

    (archive.handler as jest.Mock).mockRejectedValue(false);

    const step = new TypeCleanStep();
    const result = await step.run(argv);

    expect(archive.handler).toHaveBeenCalled();
    expect(result).toBeFalsy();
  });
});
