import { ContentItem, ContentItemPublishingStatus } from 'dc-management-sdk-js';
import { BurstableQueue } from '../burstable-queue/burstable-queue';

export class ContentItemUnpublishingService {
  private queue;

  constructor() {
    this.queue = new BurstableQueue({});
  }

  async unpublish(contentItem: ContentItem, action: (contentItem: ContentItem) => void) {
    const canUnpublish = (state: ContentItemPublishingStatus | undefined) =>
      state && [ContentItemPublishingStatus.LATEST, ContentItemPublishingStatus.EARLY].includes(state);
    this.queue.add(async () => {
      if (canUnpublish(contentItem.publishingStatus)) {
        await contentItem.related.unpublish();
      }

      action(contentItem);
    });
  }

  async onIdle() {
    return this.queue.onIdle();
  }
}
