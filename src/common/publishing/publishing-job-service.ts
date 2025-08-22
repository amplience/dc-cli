import { DynamicContent } from 'dc-management-sdk-js';
import { BurstableQueue } from '../burstable-queue/burstable-queue';

export class PublishingJobService {
  private client;
  private queue;
  private resolvedPublishJobs = [];

  constructor(client: DynamicContent) {
    this.client = client;
    this.queue = new BurstableQueue({});
  }

  async check(publishJob, action: () => Promise<void>) {
    this.queue.add(async () => {
      const checkedPublishJob = await this.client.publishJobs.get(publishJob.id);

      if (checkedPublishJob.state === 'FAILED' || checkedPublishJob.state === 'COMPLETED') {
        this.resolvedPublishJobs.push(checkedPublishJob);
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
    return resolvedPublishJobs.find(job => job.state === 'COMPLETED');
  }

  failedJobs() {
    return resolvedPublishJobs.find(job => job.state === 'FAILED');
  }
}
