import { ContentItem } from 'dc-management-sdk-js';
import { BurstableQueue } from '../burstable-queue/burstable-queue';

export class PublishingService {
  private queue;
  private _publishJobs: ContentItem[] = [];

  constructor() {
    this.queue = new BurstableQueue({});
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
