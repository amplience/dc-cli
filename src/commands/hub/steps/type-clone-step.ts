import { CloneHubStep } from '../model/clone-hub-step';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';

import { handler as exportType } from '../../content-type/export';
import { handler as importType } from '../../content-type/import';
import dynamicContentClientFactory from '../../../services/dynamic-content-client-factory';
import { FileLog } from '../../../common/file-log';
import { existsSync } from 'fs';

export class TypeCloneStep implements CloneHubStep {
  getName(): string {
    return 'Clone Content Types';
  }

  async run(state: CloneHubState): Promise<boolean> {
    try {
      await exportType({
        dir: join(state.path, 'oldType'),
        force: true,
        logFile: state.logFile,
        ...state.to
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not export existing destination types. \n${e}`);
      return false;
    }

    try {
      await exportType({
        dir: join(state.path, 'type'),
        force: true,
        logFile: state.logFile,
        ...state.from
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not export types. \n${e}`);
      return false;
    }

    try {
      await importType({
        dir: join(state.path, 'type'),
        sync: true,
        logFile: state.logFile,
        ...state.to
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not import types. \n${e}`);
      return false;
    }

    return true;
  }

  async revert(state: CloneHubState): Promise<boolean> {
    const client = dynamicContentClientFactory(state.to);

    const toArchive = (state.revertLog as FileLog).getData('CREATE', this.getName());
    const toUpdate = (state.revertLog as FileLog).getData('UPDATE', this.getName());

    for (let i = 0; i < toArchive.length; i++) {
      try {
        const type = await client.contentTypes.get(toArchive[i]);
        await type.related.archive();
        state.logFile.addAction('ARCHIVE', toArchive[i]);
      } catch (e) {
        state.logFile.appendLine(`Couldn't archive content type ${toArchive[i]}. Continuing...`);
      }
    }

    // Update using the oldType folder.
    if (toUpdate.length > 0 && existsSync(join(state.path, 'oldType'))) {
      try {
        await importType(
          {
            dir: join(state.path, 'oldType'),
            sync: true,
            logFile: state.logFile,
            ...state.to
          },
          toUpdate.map(item => item.split(' ')[0])
        );
      } catch (e) {
        state.logFile.appendLine(`ERROR: Could not import old types. \n${e}`);
        return false;
      }
    }

    return true;
  }
}
