import { HalResource, SnapshotType } from 'dc-management-sdk-js';
import { PublishingJob } from './PublishingJob';

class ContentRoot {
  public readonly id: string;
  public readonly label: string;
}
export class PublishingSnapshot extends HalResource {
  public id?: string;

  public comment?: string;

  public createdBy?: string;

  public createdDate?: string;

  public type?: SnapshotType;

  public rootContentItem: ContentRoot;

  public locale?: string;

  public readonly related = {
    publish: (scheduledDate: Date): Promise<PublishingJob> =>
      this.performActionThatReturnsResource('create-publishing-job', {}, { scheduledDate }, PublishingJob),

    self: (): Promise<PublishingSnapshot> => this.fetchLinkedResource('self', {}, PublishingSnapshot)
  };
}
