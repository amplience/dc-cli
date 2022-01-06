import { CloneHubStep, CloneHubStepId } from '../model/clone-hub-step';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';

import { handler as exportIndex } from '../../search-index/export';
import { handler as importIndex } from '../../search-index/import';
import { FileLog } from '../../../common/file-log';
import { existsSync } from 'fs';

export class IndexCloneStep implements CloneHubStep {
  getId(): CloneHubStepId {
    return CloneHubStepId.Index;
  }

  getName(): string {
    return 'Clone Indexes';
  }

  async run(state: CloneHubState): Promise<boolean> {
    try {
      state.logFile.appendLine(`Exporting existing indexes from destination.`);
      await exportIndex({
        dir: join(state.path, 'oldIndex'),
        force: true,
        logFile: state.logFile,
        ...state.to
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not export existing indexes. \n${e}`);
      return false;
    }

    try {
      state.logFile.appendLine(`Exporting indexes from source.`);
      await exportIndex({
        dir: join(state.path, 'index'),
        force: true,
        logFile: state.logFile,
        ...state.from
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not export indexes. \n${e}`);
      return false;
    }

    try {
      await importIndex({
        dir: join(state.path, 'index'),
        logFile: state.logFile,
        webhooks: true,
        ...state.to
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not import indexes. \n${e}`);
      return false;
    }

    return true;
  }

  async revert(state: CloneHubState): Promise<boolean> {
    // Deleting indexes leaves names reserved and unusable, so CREATE actions are ignored.
    const toUpdate = (state.revertLog as FileLog).getData('UPDATE', this.getName());

    // Update using the oldIndex folder.
    if (toUpdate.length > 0 && existsSync(join(state.path, 'oldIndex'))) {
      try {
        await importIndex(
          {
            dir: join(state.path, 'oldIndex'),
            logFile: state.logFile,
            ...state.to
          },
          toUpdate.map(item => item.split(' ')[0])
        );
      } catch (e) {
        state.logFile.appendLine(`ERROR: Could not import old indexes. \n${e}`);
        return false;
      }
    }

    return true;
  }
}
