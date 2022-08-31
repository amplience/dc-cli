import { ContentItem } from 'dc-management-sdk-js';
import _ from 'lodash';
import { ConfigurationParameters } from '../../commands/configure';
import async from 'async';
import { PublishingJob } from './publish-queue';
import AmplienceRestClient from './amplience-rest-client';

// rate limit is 100 publish requests per minute
export const RATE_LIMIT_INTERVAL = 60000; // in ms
export const RATE_LIMIT_THRESHOLD = 100; // chunk size

const sleep = (delay: number) => new Promise(resolve => setTimeout(resolve, delay));
const RateLimitedPublishQueue = {
  getInstance: (args: ConfigurationParameters) => {
    const queue: ContentItem[] = [];
    const restClient = AmplienceRestClient(args);

    const waitForPublishingJob = async (jobUrl: string): Promise<any> => {
      const jobStatus: PublishingJob = (await restClient.get(jobUrl)).data;
      if (jobStatus.state !== 'COMPLETED' && jobStatus.state !== 'FAILED') {
        await sleep(500);
        return await waitForPublishingJob(jobUrl);
      }
      return jobStatus;
    };

    const publishContentItem = async (item: ContentItem): Promise<any> => {
      const response = await restClient.post(`/content-items/${item.id}/publish`);
      if (response.status != 204) {
        throw new Error(`Failed to start publish: ${response.statusText} - ${await response.text()}`);
      }
      if (!response.headers['location']) {
        throw new Error('Expected publish job location in header. Has the publish workflow changed?');
      }
      return await waitForPublishingJob(response.headers['location']);
    };

    return {
      publish: async (item: ContentItem): Promise<any> => {
        queue.push(item);
      },

      waitForAll: async (): Promise<PublishingJob[]> => {
        return await async.mapLimit(queue, RATE_LIMIT_THRESHOLD, async (item: ContentItem) => {
          const itemStart = new Date().valueOf();
          const result = await publishContentItem(item);

          // rate limit the next item in the queue
          const elapsed = new Date().valueOf() - itemStart;
          await sleep(RATE_LIMIT_INTERVAL - elapsed);
          return result;
        });
      }
    };
  }
};
export default RateLimitedPublishQueue;
