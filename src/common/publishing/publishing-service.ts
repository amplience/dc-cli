import { ContentItem } from 'dc-management-sdk-js';
import { BurstableQueue, BurstableQueueOptions } from '../burstable-queue/burstable-queue';

export class PublishingService {
  private queue;
  private _publishJobs: ContentItem[] = [];

  constructor(options: BurstableQueueOptions) {
    this.queue = new BurstableQueue(options);
  }

  async publish(contentItem: ContentItem, action: () => void) {
    this.queue.add(async () => {
      const publishJob = await contentItem.related.publish();
      this._publishJobs.push(publishJob);
      action();
    });
  }

  get publishJobs() {
    return this._publishJobs;
  }

  async onIdle() {
    return this.queue.onIdle();
  }
}
