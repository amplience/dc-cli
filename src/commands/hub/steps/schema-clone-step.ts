import { CloneHubStep } from '../model/clone-hub-step';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';

import { handler as exportSchema } from '../../content-type-schema/export';
import { handler as importSchema } from '../../content-type-schema/import';
import dynamicContentClientFactory from '../../../services/dynamic-content-client-factory';
import paginator from '../../../common/dc-management-sdk-js/paginator';
import { FileLog } from '../../../common/file-log';

export class SchemaCloneStep implements CloneHubStep {
  getName(): string {
    return 'Clone Content Type Schema';
  }

  async run(state: CloneHubState): Promise<boolean> {
    try {
      await exportSchema({
        dir: join(state.path, 'schema'),
        force: state.argv.force,
        logFile: state.logFile,
        ...state.from
      });
    } catch (e) {
      return false;
    }

    try {
      await importSchema({
        dir: join(state.path, 'schema'),
        logFile: state.logFile,
        ...state.to
      });
    } catch (e) {
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

    for (let i = 0; i < toArchive.length; i++) {
      const schema = await client.contentTypeSchemas.get(toArchive[i]);
      await schema.related.archive();
    }

    for (let i = 0; i < toUpdate.length; i++) {
      const updateArgs = toUpdate[i].split(' ');

      const schema = await client.contentTypeSchemas.getByVersion(updateArgs[0], Number(updateArgs[1]));
      await schema.related.update(schema);

      const typeToSync = types.find(type => type.contentTypeUri === schema.schemaId);
      if (typeToSync) {
        typeToSync.related.contentTypeSchema.update();
      }
    }

    return true;
  }
}
