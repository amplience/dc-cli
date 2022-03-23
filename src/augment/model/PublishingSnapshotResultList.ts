import { HalClient, HalResource } from 'dc-management-sdk-js';
import { PublishingSnapshot } from './PublishingSnapshot';

export class PublishingSnapshotResultList extends HalResource {
  public hubId?: string;

  public snapshots: Array<PublishingSnapshot>;

  constructor(data: PublishingSnapshotResultList) {
    super(data);

    this.snapshots = this.snapshots.map(node => new PublishingSnapshot(node));
  }

  setClient(client: HalClient): void {
    this.client = client;

    this.snapshots.forEach(snapshot => {
      snapshot.setClient(client);
    });
  }
}
