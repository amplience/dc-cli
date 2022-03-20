import { HalResource, SnapshotType } from 'dc-management-sdk-js';
import { PublishingJob } from './PublishingJob';

export class PublishingSnapshot extends HalResource {
  public id?: string;

  public comment?: string;

  public createdBy?: string;

  public createdDate?: string;

  public type?: SnapshotType;

  public readonly related = {
    publish: (scheduledDate: Date): Promise<PublishingJob> =>
      this.performActionThatReturnsResource('create-publishing-job', {}, { scheduledDate }, PublishingJob)
  };
}
