import Yargs from 'yargs/yargs';
import { builder } from './job';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

describe('job command', () => {
  it('should build', () => {
    const argv = Yargs(process.argv.slice(2));
    const spyCommandDir = jest.spyOn(argv, 'commandDir').mockReturnValue(argv);
    builder(argv);
    expect(spyCommandDir).toHaveBeenCalledWith('job', YargsCommandBuilderOptions);
  });
});
