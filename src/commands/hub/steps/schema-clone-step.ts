import { CloneHubStep, CloneHubStepId } from '../model/clone-hub-step';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';

import { handler as exportSchema } from '../../content-type-schema/export';
import { handler as importSchema } from '../../content-type-schema/import';
import dynamicContentClientFactory from '../../../services/dynamic-content-client-factory';
import paginator from '../../../common/dc-management-sdk-js/paginator';
import { FileLog } from '../../../common/file-log';
import { Status } from 'dc-management-sdk-js';

export class SchemaCloneStep implements CloneHubStep {
  getId(): CloneHubStepId {
    return CloneHubStepId.Schema;
  }

  getName(): string {
    return 'Clone Content Type Schemas';
  }

  async run(state: CloneHubState): Promise<boolean> {
    try {
      await exportSchema({
        dir: join(state.path, 'schema'),
        force: true,
        logFile: state.logFile,
        ...state.from
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not export schemas. \n${e}`);
      return false;
    }

    try {
      await importSchema({
        dir: join(state.path, 'schema'),
        logFile: state.logFile,
        ...state.to
      });
    } catch (e) {
      state.logFile.appendLine(`ERROR: Could not import schemas. \n${e}`);
      return false;
    }

    return true;
  }

  async revert(state: CloneHubState): Promise<boolean> {
    const client = dynamicContentClientFactory(state.to);
    const hub = await client.hubs.get(state.to.hubId);

    const types = await paginator(hub.related.contentTypes.list);

    const revertLog = state.revertLog as FileLog;
    const toArchive = revertLog.getData('CREATE', this.getName());
    const toUpdate = revertLog.getData('UPDATE', this.getName());

    for (const id of toArchive) {
      try {
        const schema = await client.contentTypeSchemas.get(id);
        if (schema.status === Status.ACTIVE) {
          await schema.related.archive();
        }
      } catch (e) {
        state.logFile.appendLine(`Could not archive ${id}. Continuing...`);
      }
    }

    for (const id of toUpdate) {
      const updateArgs = id.split(' ');

      try {
        const schema = await client.contentTypeSchemas.getByVersion(updateArgs[0], Number(updateArgs[1]));
        await schema.related.update(schema);

        const typeToSync = types.find(type => type.contentTypeUri === schema.schemaId);
        if (typeToSync) {
          typeToSync.related.contentTypeSchema.update();
        }
      } catch (e) {
        state.logFile.appendLine(`Error while updating ${id}. Continuing...`);
      }
    }

    return true;
  }
}
