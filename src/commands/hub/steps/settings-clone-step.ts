import { CloneHubStep } from '../model/clone-hub-step';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';
import { readdirSync } from 'fs';

import { handler as exportSettings } from '../../settings/export';
import { handler as importSettings } from '../../settings/import';
import { ensureDirectoryExists } from '../../../common/import/directory-utils';

export class SettingsCloneStep implements CloneHubStep {
  getName(): string {
    return 'Clone Settings';
  }

  findItem(path: string, hubId: string): string | undefined {
    const items = readdirSync(join(path, 'settings'));
    return items.find(item => {
      return /^hub\-.*\.json$/.test(item) && item.indexOf(hubId) != -1;
    });
  }

  async run(state: CloneHubState): Promise<boolean> {
    try {
      await ensureDirectoryExists(join(state.path, 'settings'));
      await exportSettings({
        dir: join(state.path, 'settings'),
        logFile: state.logFile,
        force: state.argv.force,
        ...state.from
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not export settings. \n${e}`);
      return false;
    }

    try {
      try {
        state.logFile.appendLine('Backing up destination settings.');
        await exportSettings({
          dir: join(state.path, 'settings'),
          logFile: state.logFile,
          force: state.argv.force,
          ...state.to
        });
      } catch (e) {
        state.logFile.appendLine('Failed to back up destination settings. Continuing.');
      }

      const matchingFile = this.findItem(state.path, state.from.hubId);
      if (matchingFile == null) {
        state.logFile.appendLine('Error: Could not find exported settings file.');
        return false;
      }

      await importSettings({
        filePath: join(state.path, 'settings', matchingFile),
        mapFile: state.argv.mapFile,
        force: state.argv.force,
        logFile: state.logFile,
        ...state.to
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not import settings. \n${e}`);
      return false;
    }

    return true;
  }

  async revert(state: CloneHubState): Promise<boolean> {
    try {
      const matchingFile = this.findItem(state.path, state.to.hubId);
      if (matchingFile == null) {
        state.logFile.appendLine('Error: Could not find exported settings file.');
        return false;
      }

      await importSettings({
        filePath: join(state.path, 'settings', matchingFile),
        mapFile: state.argv.mapFile,
        force: state.argv.force,
        logFile: state.logFile,
        ...state.to
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not import old settings. \n${e}`);
      return false;
    }

    return true;
  }
}
