import { builder, command } from './export';
import Yargs from 'yargs/yargs';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');
jest.mock('../../common/dc-management-sdk-js/paginator');
jest.mock('fs');
jest.mock('table');

describe('content-type export command', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should implement an export command', () => {
    expect(command).toEqual('export <dir>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();
      const spyArray = jest.spyOn(argv, 'array').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Output directory for the exported Content Type definitions',
        type: 'string'
      });
      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        describe: 'content-type-schema ID(s) of Content Type(s) to export',
        requiresArg: true
      });
      expect(spyArray).toHaveBeenCalledWith('schemaId');
    });
  });
});
