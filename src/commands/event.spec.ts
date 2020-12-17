import { builder } from './event';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import Yargs from 'yargs/yargs';

describe('event command', function() {
  it('should include the commands in the event dir', () => {
    const argv = Yargs(process.argv.slice(2));
    const spyCommandDir = jest.spyOn(argv, 'commandDir').mockReturnValue(argv);
    builder(argv);
    expect(spyCommandDir).toHaveBeenCalledWith('event', YargsCommandBuilderOptions);
  });
});
