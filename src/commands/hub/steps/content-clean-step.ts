import { Arguments } from 'yargs';
import { FileLog } from '../../../common/file-log';
import { CleanHubBuilderOptions } from '../../../interfaces/clean-hub-builder-options';
import { ConfigurationParameters } from '../../configure';
import { handler } from '../../content-item/archive';
import { CleanHubStep } from '../model/clean-hub-step';

export class ContentCleanStep implements CleanHubStep {
  getName(): string {
    return 'Clean Content';
  }

  async run(argv: Arguments<CleanHubBuilderOptions & ConfigurationParameters>): Promise<boolean> {
    try {
      await handler({
        ...argv
      });
    } catch (e) {
      (argv.logFile as FileLog).appendLine(`ERROR: Could not archive content. \n${e}`);
      return false;
    }

    return true;
  }
}
