import {
  ContentItem,
  Oauth2AuthHeaderProvider,
  AxiosHttpClient,
  PatTokenAuthHeaderProvider
} from 'dc-management-sdk-js';
import fetch, { Response } from 'node-fetch';
import { HalLink } from 'dc-management-sdk-js/build/main/lib/hal/models/HalLink';
import { ConfigurationParameters } from '../../commands/configure';

export interface PublishingJob {
  id: string;
  scheduledDate: string;
  createdDate: string;
  createdBy: string;
  state: 'PREPARING' | 'PUBLISHING' | 'COMPLETED' | 'FAILED';

  _links?: { [name: string]: HalLink };
}

export const delay = (duration: number): Promise<void> => {
  return new Promise<void>((resolve): void => {
    setTimeout(resolve, duration);
  });
};

export interface JobRequest {
  item: ContentItem;
  href: string;
}

export class PublishQueue {
  maxWaiting = 35;
  maxAttempts = 30;
  attemptDelay = 1000;
  attemptRateLimit = 60000 / 35; // 35 publishes a minute.
  failedJobs: JobRequest[] = [];

  private inProgressJobs: JobRequest[] = [];
  private waitingList: { promise: Promise<void>; resolver: () => void }[] = [];
  private auth: Oauth2AuthHeaderProvider | PatTokenAuthHeaderProvider;
  private awaitingAll: boolean;
  private delayUntil: number[] = [];
  private delayId = 0;
  waitInProgress = false;

  constructor(credentials: ConfigurationParameters) {
    const http = new AxiosHttpClient({});
    if (credentials.clientId && credentials.clientSecret) {
      this.auth = new Oauth2AuthHeaderProvider(
        // eslint-disable-next-line @typescript-eslint/camelcase
        { client_id: credentials.clientId, client_secret: credentials.clientSecret },
        { authUrl: process.env.AUTH_URL },
        http
      );
    } else if (credentials.patToken) {
      this.auth = new PatTokenAuthHeaderProvider(credentials.patToken);
    }
  }

  private async fetch(href: string, method: string): Promise<Response> {
    return await fetch(href, { method: method, headers: { Authorization: await this.auth.getAuthHeader() } });
  }

  async publish(item: ContentItem): Promise<void> {
    await this.rateLimit();

    // Do publish
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publishLink = (item._links as any)['publish'];

    if (publishLink == null) {
      throw new Error('Cannot publish the item - link not available.');
    }

    // Need to manually fetch the publish endpoint.

    const publish = await this.fetch(publishLink.href, 'POST');
    if (publish.status != 204) {
      throw new Error(`Failed to start publish: ${publish.statusText} - ${await publish.text()}`);
    }

    const publishJobInfoHref = publish.headers.get('Location');

    if (publishJobInfoHref == null) {
      throw new Error('Expected publish job location in header. Has the publish workflow changed?');
    }

    this.inProgressJobs.push({ href: publishJobInfoHref, item });
  }

  private async waitForOldestPublish(): Promise<void> {
    if (this.inProgressJobs.length === 0) {
      return;
    }

    this.waitInProgress = true;

    const oldestJob = this.inProgressJobs[0];
    this.inProgressJobs.splice(0, 1);

    // Request the status for the oldest ID.
    // If it's still not published/errored, then wait a bit and try again.

    let attempts = 0;
    for (; attempts < this.maxAttempts; attempts++) {
      let job: PublishingJob;
      try {
        job = await (await this.fetch(oldestJob.href, 'GET')).json();
      } catch (e) {
        // Could not fetch job information.
        continue;
      }

      if (job.state === 'COMPLETED') {
        break;
      } else if (job.state === 'FAILED') {
        this.failedJobs.push(oldestJob);
        break;
      } else {
        await delay(this.attemptDelay);
      }
    }

    if (attempts == this.maxAttempts) {
      this.failedJobs.push(oldestJob);
    }

    // The wait completed. Notify the first in the queue.

    const oldestWaiter = this.waitingList[0];
    if (oldestWaiter != null) {
      this.waitingList.splice(0, 1);

      oldestWaiter.resolver(); // Resolve the promise.
    }

    if (this.waitingList.length > 0 || this.awaitingAll) {
      // Still more waiting.
      await this.waitForOldestPublish();
    } else {
      this.waitInProgress = false;
    }
  }

  private async rateLimit(): Promise<void> {
    // Rate limit by time.
    const now = Date.now();

    if (now < this.delayUntil[this.delayId] || 0) {
      await delay(this.delayUntil[this.delayId] - now);
    }

    this.delayUntil[this.delayId] = now + this.attemptRateLimit * this.maxWaiting;
    this.delayId = (this.delayId + 1) % this.maxWaiting;

    // Rate limit by concurrent volume.

    if (this.inProgressJobs.length != this.maxWaiting) {
      return;
    }

    // We need to wait.
    let resolver: () => void = () => {
      /* */
    };
    const myPromise = new Promise<void>((resolve): void => {
      resolver = resolve;
    });

    this.waitingList.push({ promise: myPromise, resolver: resolver });

    if (!this.waitInProgress) {
      // Start a wait.
      this.waitForOldestPublish();
    }

    await myPromise;
  }

  async waitForAll(): Promise<void> {
    if (this.waitInProgress) {
      // Wait for the last item on the list to complete.
      await this.waitingList[this.waitingList.length - 1].promise;
    }

    // Continue regardless of waiters.
    this.awaitingAll = true;
    await this.waitForOldestPublish();
  }
}
