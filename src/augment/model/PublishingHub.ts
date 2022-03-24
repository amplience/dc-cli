import { HalResource, Snapshot } from 'dc-management-sdk-js';
import { PublishingSnapshotResultList } from './PublishingSnapshotResultList';

export class PublishingHub extends HalResource {
  public readonly related = {
    snapshots: {
      create: (resource: Snapshot[]): Promise<PublishingSnapshotResultList> =>
        this.performActionThatReturnsResource('batch-create-snapshots', {}, resource, PublishingSnapshotResultList),
      list: (): Promise<PublishingSnapshotResultList> =>
        this.fetchLinkedResource('snapshots', {}, PublishingSnapshotResultList)
    }
  };
}
