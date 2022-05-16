import { CloneHubStep, CloneHubStepId } from '../model/clone-hub-step';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';

import { handler as exportEvent } from '../../event/export';
import { handler as importEvent } from '../../event/import';
import { FileLog } from '../../../common/file-log';
import { existsSync } from 'fs';
import dynamicContentClientFactory from '../../../services/dynamic-content-client-factory';

export class EventCloneStep implements CloneHubStep {
  getId(): CloneHubStepId {
    return CloneHubStepId.Event;
  }

  getName(): string {
    return 'Clone Events';
  }

  isLimited = true;

  async run(state: CloneHubState): Promise<boolean> {
    try {
      state.logFile.appendLine(`Exporting existing events from destination.`);
      await exportEvent({
        dir: join(state.path, 'oldEvent'),
        force: true,
        snapshots: false,
        logFile: state.logFile,
        ...state.to
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not export existing events. \n${e}`);
      return false;
    }

    try {
      state.logFile.appendLine(`Exporting events from source.`);
      await exportEvent({
        dir: join(state.path, 'event'),
        force: true,
        snapshots: false,
        logFile: state.logFile,
        ...state.from
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not export events. \n${e}`);
      return false;
    }

    try {
      await importEvent({
        dir: join(state.path, 'event'),
        logFile: state.logFile,
        mapFile: state.argv.mapFile,
        originalIds: false,
        schedule: true,
        acceptSnapshotLimits: true,
        catchup: false,
        ...state.to
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not import events. \n${e}`);
      return false;
    }

    return true;
  }

  async revert(state: CloneHubState): Promise<boolean> {
    const client = dynamicContentClientFactory(state.to);

    const toArchive = (state.revertLog as FileLog).getData('EVENT-CREATE', this.getName());
    const toUpdate = (state.revertLog as FileLog).getData('EVENT-UPDATE', this.getName());

    for (let i = 0; i < toArchive.length; i++) {
      try {
        const event = await client.events.get(toArchive[i]);
        await event.related.archive();
        state.logFile.addAction('ARCHIVE', toArchive[i]);
      } catch (e) {
        state.logFile.appendLine(`Couldn't archive event ${toArchive[i]}. Continuing...`);
      }
    }

    // Update using the oldEvent folder.
    if (toUpdate.length > 0 && existsSync(join(state.path, 'oldEvent'))) {
      try {
        await importEvent(
          {
            dir: join(state.path, 'oldEvent'),
            logFile: state.logFile,
            mapFile: state.argv.mapFile,
            originalIds: true,
            schedule: true,
            acceptSnapshotLimits: true,
            catchup: false,
            ...state.to
          }
          /*,
          toUpdate.map(item => item.split(' ')[0])
          */
        );
      } catch (e) {
        state.logFile.appendLine(`ERROR: Could not import old events. \n${e}`);
        return false;
      }
    }

    return true;
  }
}
