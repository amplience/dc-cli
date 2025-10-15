import { ContentItem, PublishingJob } from 'dc-management-sdk-js';
import { BurstableQueue } from '../burstable-queue/burstable-queue';

export class ContentItemPublishingService {
  private queue;
  private _publishJobs: PublishingJob[] = [];

  constructor() {
    this.queue = new BurstableQueue({});
  }

  async publish(contentItem: ContentItem, action: (contentItem: ContentItem, publishJob: PublishingJob) => void) {
    this.queue.add(async () => {
      const publishJobLocation = await contentItem.related.publish();
      const publishJob = await publishJobLocation.related.publishingJob();
      this._publishJobs.push(publishJob);
      action(contentItem, publishJob);
    });
  }

  get publishJobs() {
    return this._publishJobs;
  }

  async onIdle() {
    return this.queue.onIdle();
  }
}
