import { Arguments } from 'yargs';
import { FileLog } from '../../../common/file-log';
import { CleanHubBuilderOptions } from '../../../interfaces/clean-hub-builder-options';
import { ConfigurationParameters } from '../../configure';
import { handler } from '../../content-type-schema/archive';
import { CleanHubStep, CleanHubStepId } from '../model/clean-hub-step';

export class SchemaCleanStep implements CleanHubStep {
  getId(): CleanHubStepId {
    return CleanHubStepId.Schema;
  }

  getName(): string {
    return 'Clean Content Type Schemas';
  }

  async run(argv: Arguments<CleanHubBuilderOptions & ConfigurationParameters>): Promise<boolean> {
    try {
      await handler({
        ...argv
      });
    } catch (e) {
      (argv.logFile as FileLog).appendLine(`ERROR: Could not archive schemas. \n${e}`);
      return false;
    }

    return true;
  }
}
