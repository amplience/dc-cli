import { Arguments } from 'yargs';
import { FileLog } from '../../../common/file-log';
import { CleanHubBuilderOptions } from '../../../interfaces/clean-hub-builder-options';
import { ConfigurationParameters } from '../../configure';
import { handler } from '../../content-type/archive';
import { CleanHubStep } from '../model/clean-hub-step';

export class TypeCleanStep implements CleanHubStep {
  getName(): string {
    return 'Clean Content Types';
  }

  async run(argv: Arguments<CleanHubBuilderOptions & ConfigurationParameters>): Promise<boolean> {
    try {
      await handler({
        ...argv
      });
    } catch (e) {
      (argv.logFile as FileLog).appendLine(`ERROR: Could not archive types. \n${e}`);
      return false;
    }

    return true;
  }
}
