import { HalResource } from 'dc-management-sdk-js';
import { PublishingSnapshot } from './PublishingSnapshot';

export class PublishingSnapshotResultList extends HalResource {
  hubId: string;

  snapshots: PublishingSnapshot[];
}
