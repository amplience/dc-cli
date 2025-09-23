import { ContentItem, ContentItemPublishingStatus } from 'dc-management-sdk-js';
import { BurstableQueue } from '../burstable-queue/burstable-queue';

export class ContentItemUnpublishingService {
  private queue;

  constructor() {
    this.queue = new BurstableQueue({});
  }

  async unpublish(contentItem: ContentItem, action: (contentItem: ContentItem) => void) {
    this.queue.add(async () => {
      if (contentItem.publishingStatus !== ContentItemPublishingStatus.UNPUBLISHED) {
        await contentItem.related.unpublish();
      }

      action(contentItem);
    });
  }

  async onIdle() {
    return this.queue.onIdle();
  }
}
