import { builder } from './content-item';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';
import Yargs from 'yargs/yargs';
import { configureCommandOptions } from './configure';

describe('content-item command', function() {
  it('should include the commands in the content-item dir', () => {
    const argv = Yargs(process.argv.slice(2));
    const spyCommandDir = jest.spyOn(argv, 'commandDir').mockReturnValue(argv);
    const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();
    const spyConfig = jest.spyOn(argv, 'config').mockReturnThis();
    builder(argv);
    expect(spyCommandDir).toHaveBeenCalledWith('content-item', YargsCommandBuilderOptions);
    expect(spyOptions).toHaveBeenCalledWith(configureCommandOptions);
    expect(spyConfig).toHaveBeenCalledWith('config', expect.any(Function));
  });
});
