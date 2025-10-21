import { DynamicContent, PublishingJob } from 'dc-management-sdk-js';
import { BurstableQueue } from '../burstable-queue/burstable-queue';
import { PublishingJobStatus } from 'dc-management-sdk-js/build/main/lib/model/PublishingJobStatus';

export class ContentItemPublishingJobService {
  private client;
  private queue;

  constructor(client: DynamicContent) {
    this.client = client;
    this.queue = new BurstableQueue({});
  }

  async check(publishingJob: PublishingJob, action: (publishingJob: PublishingJob) => Promise<void>) {
    this.queue.add(async () => {
      const latestPublishJob = await this.client.publishingJob.get(publishingJob.id);

      if (
        latestPublishJob.state === PublishingJobStatus.FAILED ||
        latestPublishJob.state === PublishingJobStatus.COMPLETED
      ) {
        action(latestPublishJob);
      } else {
        // if publish has not been done then add it to the back of the queue
        this.check(latestPublishJob, action);
      }
    });
  }

  async onIdle() {
    return this.queue.onIdle();
  }

  get size() {
    return this.queue.size();
  }

  get pending() {
    return this.queue.pending();
  }
}
