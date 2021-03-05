import { CloneHubStep } from '../model/clone-hub-step';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';

import { handler as copyContent } from '../../content-item/copy';

export class ContentCloneStep implements CloneHubStep {
  getName(): string {
    return 'Clone Content';
  }

  async run(state: CloneHubState): Promise<boolean> {
    const copySuccess = await copyContent({
      ...state.argv,
      dir: join(state.path, 'content'),
      logFile: state.logFile
    });

    return copySuccess;
  }

  async revert(state: CloneHubState): Promise<boolean> {
    // Revert argument is passed as true to the clone command.
    const revertSuccess = await copyContent({
      ...state.argv,
      dir: join(state.path, 'content'),
      logFile: state.logFile,
      revertLog: state.revertLog
    });

    return revertSuccess;
  }
}
