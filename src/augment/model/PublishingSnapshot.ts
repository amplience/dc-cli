import { HalResource, SnapshotType } from 'dc-management-sdk-js';
import { PublishingJob } from './PublishingJob';

class ContentRoot {
  public readonly id: string;
  public readonly label: string;

  constructor(data: ContentRoot) {
    this.id = data.id;
    this.label = data.label;
  }
}
export class PublishingSnapshot extends HalResource {
  public id?: string;

  public comment?: string;

  public createdBy?: string;

  public createdDate?: string;

  public type?: SnapshotType;

  public contentRoot: ContentRoot;

  public readonly related = {
    publish: (scheduledDate: Date): Promise<PublishingJob> =>
      this.performActionThatReturnsResource('create-publishing-job', {}, { scheduledDate }, PublishingJob),

    self: (): Promise<PublishingSnapshot> => this.fetchLinkedResource('self', {}, PublishingSnapshot)
  };
}
