import Yargs from 'yargs/yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import { builder, hubBuilder } from './hub';

describe('hub manager', function() {
  it('should build yargs', async () => {
    const argv = Yargs(process.argv.slice(2));
    const spyCommandDir = jest.spyOn(argv, 'commandDir').mockReturnValue(argv);
    const spyCommand = jest.spyOn(argv, 'command');
    builder(argv);
    expect(spyCommandDir).toHaveBeenCalledWith('hub', YargsCommandBuilderOptions);
    expect(spyCommand).toHaveBeenCalledTimes(4);
  });

  it('should build hub use args', async () => {
    const argv = Yargs(process.argv.slice(2));
    const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
    hubBuilder(argv);
    expect(spyPositional).toHaveBeenCalledWith('hub', {
      describe: 'hub name',
      type: 'string',
      demandOption: false,
      default: ''
    });
  });
});
