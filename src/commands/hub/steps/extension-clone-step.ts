import { CloneHubStep, CloneHubStepId } from '../model/clone-hub-step';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';

import { handler as exportExtension } from '../../extension/export';
import { handler as importExtension } from '../../extension/import';
import { FileLog } from '../../../common/file-log';
import { existsSync } from 'fs';

export class ExtensionCloneStep implements CloneHubStep {
  getId(): CloneHubStepId {
    return CloneHubStepId.Extension;
  }

  getName(): string {
    return 'Clone Extensions';
  }

  async run(state: CloneHubState): Promise<boolean> {
    try {
      state.logFile.appendLine(`Exporting existing extensions from destination.`);
      await exportExtension({
        dir: join(state.path, 'oldExtension'),
        force: true,
        logFile: state.logFile,
        ...state.to
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not export existing extensions. \n${e}`);
      return false;
    }

    try {
      state.logFile.appendLine(`Exporting extensions from source.`);
      await exportExtension({
        dir: join(state.path, 'extension'),
        force: true,
        logFile: state.logFile,
        ...state.from
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not export extensions. \n${e}`);
      return false;
    }

    try {
      await importExtension({
        dir: join(state.path, 'extension'),
        logFile: state.logFile,
        ...state.to
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not import extensions. \n${e}`);
      return false;
    }

    return true;
  }

  async revert(state: CloneHubState): Promise<boolean> {
    // Deleting extensions leaves names reserved and unusable, so CREATE actions are ignored.
    const toUpdate = (state.revertLog as FileLog).getData('UPDATE', this.getName());

    // Update using the oldExtension folder.
    if (toUpdate.length > 0 && existsSync(join(state.path, 'oldExtension'))) {
      try {
        await importExtension(
          {
            dir: join(state.path, 'oldExtension'),
            logFile: state.logFile,
            ...state.to
          },
          toUpdate.map(item => item.split(' ')[0])
        );
      } catch (e) {
        state.logFile.appendLine(`ERROR: Could not import old extensions. \n${e}`);
        return false;
      }
    }

    return true;
  }
}
