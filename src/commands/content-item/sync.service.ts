import { ContentItem, CreateDeepSyncJobRequest, Hub, Job } from 'dc-management-sdk-js';
import { BurstableQueue } from '../../common/burstable-queue/burstable-queue';
import { setTimeout } from 'node:timers/promises';

const DELAY = 200;

export class ContentItemSyncService {
  private queue;
  private _failedJobs: Job[] = [];

  constructor() {
    this.queue = new BurstableQueue({ concurrency: 1 });
  }

  sync(destinationHubId: string, hub: Hub, contentItem: ContentItem, action: (job: Job) => void): void {
    this.queue.add(async () => {
      const createSyncJob = await hub.related.jobs.createDeepSyncJob(
        new CreateDeepSyncJobRequest({
          label: `dc-cli content item: ${contentItem.label}`,
          ignoreSchemaValidation: true,
          destinationHubId,
          input: { rootContentItemIds: [contentItem.id] }
        })
      );

      const completedJob = await this.waitForJobCompletion(createSyncJob.jobId, hub);

      if (completedJob.status === 'FAILED') {
        this._failedJobs.push(completedJob);
      }

      action(completedJob);
    });
  }

  private async waitForJobCompletion(jobId: string, hub: Hub): Promise<Job> {
    let syncJob = await hub.related.jobs.get(jobId);
    while (syncJob.status === 'CREATED' || syncJob.status === 'IN_PROGRESS') {
      await setTimeout(DELAY);
      syncJob = await hub.related.jobs.get(syncJob.id);
    }
    return syncJob;
  }

  async onIdle(): Promise<void> {
    return this.queue.onIdle();
  }

  get failedJobs(): Job[] {
    return this._failedJobs;
  }
}
