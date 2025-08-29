import { ContentItem, DynamicContent, PublishingJob } from 'dc-management-sdk-js';
import { BurstableQueue } from '../burstable-queue/burstable-queue';
import { PublishingJobStatus } from 'dc-management-sdk-js/build/main/lib/model/PublishingStatus';

export class PublishingJobService {
  private client;
  private queue;
  private resolvedPublishJobs: PublishingJob[] = [];
  private pendingContentItems: ContentItem[] = [];
  private failedContentItems: ContentItem[] = [];

  constructor(client: DynamicContent) {
    this.client = client;
    this.queue = new BurstableQueue({});
  }

  async check(publishJob: ContentItem, action: () => Promise<void>) {
    this.queue.add(async () => {
      this.pendingContentItems.push(publishJob);
      const checkedPublishJob = await this.client.publishingJobs.get(publishJob.id);

      if (checkedPublishJob.state === PublishingJobStatus.FAILED) {
        this.failedContentItems.push(publishJob);
      }

      if (
        checkedPublishJob.state === PublishingJobStatus.FAILED ||
        checkedPublishJob.state === PublishingJobStatus.COMPLETED
      ) {
        this.resolvedPublishJobs.push(checkedPublishJob);

        const index = this.pendingContentItems.indexOf(publishJob);
        if (index > -1) {
          this.pendingContentItems.splice(index, 1);
        }
      } else {
        // if publish has not been done then add it to the back of the queue
        this.check(publishJob, action);
      }
      action();
    });
  }

  async onIdle() {
    return this.queue.onIdle();
  }

  completeJobs() {
    return this.resolvedPublishJobs.find(job => job.state === 'COMPLETED');
  }

  failedJobs() {
    return this.resolvedPublishJobs.find(job => job.state === 'FAILED');
  }

  get size() {
    return this.queue.size();
  }

  get pendingSize() {
    return this.queue.pending();
  }

  get pendingPublishingContentItems() {
    return this.pendingContentItems;
  }

  get failedPublishingContentItems() {
    return this.failedContentItems;
  }
}
