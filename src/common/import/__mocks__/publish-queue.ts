import { ContentItem } from 'dc-management-sdk-js';
import { JobRequest } from '../publish-queue';

export const publishCalls: ContentItem[] = [];

export class PublishQueue {
  maxWaiting = 3;
  attemptDelay = 1000;
  failedJobs: JobRequest[] = [];

  waitInProgress = false;

  constructor() {
    /* empty */
  }

  async publish(item: ContentItem): Promise<void> {
    // TODO: testing ability to throw

    publishCalls.push(item);

    return;
  }

  async waitForAll(): Promise<void> {
    // TODO: testing ability to throw (in wait for publish)

    return;
  }
}
