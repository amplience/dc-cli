import fetch from 'node-fetch';
import { OAuth2Client, ContentItem, AccessToken } from 'dc-management-sdk-js';
import { PublishingJob, PublishQueue } from './publish-queue';

jest.mock('node-fetch');
jest.mock('dc-management-sdk-js/build/main/lib/oauth2/services/OAuth2Client');

interface PublishTemplate {
  href: string;
  status: number;
  statusText: string;
  headers?: Map<string, string>;

  jsonProvider: (template: PublishTemplate) => PublishingJob;
}

const defaultTemplate: PublishTemplate = {
  href: '',
  status: 404,
  statusText: 'NOT_FOUND',

  jsonProvider: () => {
    throw new Error('Not valid JSON');
  }
};

describe('publish-queue', () => {
  describe('publishing tests', () => {
    let totalPolls = 0;
    let totalRequests = 0;
    let authRequests = 0;

    beforeEach((): void => {
      totalRequests = 0;
      totalPolls = 0;
      authRequests = 0;
    });

    afterEach((): void => {
      jest.resetAllMocks();
    });

    // should wait for all publishes to complete when calling waitForAll

    function sharedMock(templates: PublishTemplate[]): void {
      (OAuth2Client.prototype.getToken as jest.Mock).mockImplementation(() => {
        authRequests++;
        // eslint-disable-next-line @typescript-eslint/camelcase
        const result: AccessToken = { access_token: 'token-example', expires_in: 99999, refresh_token: 'refresh' };
        return Promise.resolve(result);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((fetch as any) as jest.Mock).mockImplementation((href, options) => {
        const template: PublishTemplate = templates.find(template => template.href == href) || defaultTemplate;

        if (options.headers['Authorization'] != 'bearer token-example') {
          throw new Error('Not authorized!');
        }

        totalRequests++;

        return Promise.resolve({
          status: template.status,
          statusText: template.statusText,
          headers: template.headers,
          json: jest.fn().mockImplementation(() => Promise.resolve(template.jsonProvider(template))),
          text: jest.fn().mockResolvedValue('Error Text')
        });
      });
    }

    function getPublishableItem(id: string): ContentItem {
      return new ContentItem({
        id: id,
        _links: {
          publish: {
            href: '//publish-' + id
          }
        }
      });
    }

    function publishStartTemplate(href: string, location: string): PublishTemplate {
      return {
        href: href,
        status: 204,
        statusText: 'No Content',
        headers: new Map([['Location', location]]),

        jsonProvider: (): PublishingJob => {
          throw new Error('No body');
        }
      };
    }

    function progressStepsTemplate(href: string, polls: number, fail?: boolean | number): PublishTemplate {
      let callNumber = 0;

      return {
        href: href,
        status: 200,
        statusText: 'OK',

        jsonProvider: (): PublishingJob => {
          const result: PublishingJob = {
            id: href,
            scheduledDate: '',
            createdDate: '',
            createdBy: '',
            state: 'PREPARING',
            _links: { self: { href } }
          };

          totalPolls++;

          if (typeof fail === 'number' && fail == callNumber) {
            callNumber++;
            throw new Error('Data does not parse.');
          } else {
            if (callNumber == 0 && polls > 1) {
              result.state = 'PREPARING';
            } else if (callNumber < polls - 1) {
              result.state = 'PUBLISHING';
            } else {
              result.state = fail === true ? 'FAILED' : 'COMPLETED';
            }
          }

          callNumber++;

          return result;
        }
      };
    }

    function multiMock(count: number, polls: number): ContentItem[] {
      const items: ContentItem[] = [];
      const templates: PublishTemplate[] = [];

      for (let i = 0; i < count; i++) {
        templates.push(publishStartTemplate(`//publish-id${i}`, `//publishJob-id${i}`));
        templates.push(progressStepsTemplate(`//publishJob-id${i}`, polls));

        items.push(getPublishableItem(`id${i}`));
      }

      sharedMock(templates);

      return items;
    }

    function makeQueue(): PublishQueue {
      const queue = new PublishQueue({ clientId: 'id', clientSecret: 'secret', hubId: 'hub' });
      queue.attemptDelay = 0;

      return queue;
    }

    it('should request a publish using the REST api, with authentication given by the creation arguments', async () => {
      const item1 = getPublishableItem('id1');
      sharedMock([
        publishStartTemplate('//publish-id1', '//publishJob-id1'),
        progressStepsTemplate('//publishJob-id1', 3)
      ]);

      const queue = makeQueue();

      await queue.publish(item1);

      await queue.waitForAll();

      expect(authRequests).toBeGreaterThan(0);
      expect(totalRequests).toEqual(4);
      expect(totalPolls).toEqual(3);
    });

    it('should wait for publish completion when starting a publish and attempting to publish more', async () => {
      const items = multiMock(10, 1); // 10 items, return success on the first poll (instant publish)

      const queue = makeQueue();

      for (let i = 0; i < items.length; i++) {
        await queue.publish(items[i]);

        // Starts polling when i == 1, and each time we continue one job has completed.
        expect(totalPolls).toEqual(Math.max(0, i));
      }

      await queue.waitForAll();

      expect(totalPolls).toEqual(10);
    });

    it('should never wait for publish completion when starting a publish, only when waiting or publishing more', async () => {
      const items = multiMock(1, 1); // 10 items, return success on the first poll (instant publish)

      const queue = makeQueue(); // After 1 concurrent request, start waiting.

      for (let i = 0; i < items.length; i++) {
        await queue.publish(items[i]);
      }

      expect(totalPolls).toEqual(0);

      await queue.waitForAll();

      expect(totalPolls).toEqual(1);
    });

    it('should complete immediately when calling waitForAll with no publishes in progress', async () => {
      const queue = makeQueue();

      await queue.waitForAll();

      expect(totalPolls).toEqual(0);
    });

    it('should throw an error when publish link is not present', async () => {
      const item1 = getPublishableItem('id1');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item1 as any)._links = {};
      sharedMock([
        publishStartTemplate('//publish-id1', '//publishJob-id1'),
        progressStepsTemplate('//publishJob-id1', 3)
      ]);

      const queue = makeQueue();

      let threw = false;
      try {
        await queue.publish(item1);
      } catch (e) {
        threw = true;
      }

      expect(threw).toBeTruthy();

      await queue.waitForAll();

      expect(totalPolls).toEqual(0);
    });

    it('should throw an error when publish POST response headers do not include a Location for the job status', async () => {
      const item1 = getPublishableItem('id1');
      sharedMock([
        {
          href: '//publish-id1',
          status: 204,
          statusText: 'No Content',
          headers: new Map(),

          jsonProvider: (): PublishingJob => {
            throw new Error('No body');
          }
        },
        progressStepsTemplate('//publishJob-id1', 3)
      ]);

      const queue = makeQueue();

      let threw = false;
      try {
        await queue.publish(item1);
      } catch (e) {
        threw = true;
      }

      expect(threw).toBeTruthy();

      await queue.waitForAll();

      expect(totalPolls).toEqual(0);
    });

    it('should throw an error when publish fails to start (request is not OK)', async () => {
      const item1 = getPublishableItem('id1');
      sharedMock([
        {
          href: '//publish-id1',
          status: 500,
          statusText: 'Internal Server Error',

          jsonProvider: (): PublishingJob => {
            throw new Error('No body');
          }
        },
        progressStepsTemplate('//publishJob-id1', 3)
      ]);

      const queue = makeQueue();

      let threw = false;
      try {
        await queue.publish(item1);
      } catch (e) {
        threw = true;
      }

      expect(threw).toBeTruthy();

      await queue.waitForAll();

      expect(totalPolls).toEqual(0);
    });

    it('should ignore an attempt waiting for job status if fetching it does not succeed, and request again later as usual', async () => {
      const item1 = getPublishableItem('id1');

      sharedMock([
        publishStartTemplate('//publish-id1', '//publishJob-id1'),
        progressStepsTemplate('//publishJob-id1', 3, 1)
      ]);

      const queue = makeQueue();

      await queue.publish(item1);

      await queue.waitForAll();

      expect(queue.failedJobs.length).toEqual(0);
      expect(totalPolls).toEqual(3);
      expect(totalRequests).toEqual(4);
    });

    it('should report failed publishes in the failedJobs list', async () => {
      const item1 = getPublishableItem('id1');
      const item2 = getPublishableItem('id2'); // fails
      const item3 = getPublishableItem('id3'); // fails

      sharedMock([
        publishStartTemplate('//publish-id1', '//publishJob-id1'),
        progressStepsTemplate('//publishJob-id1', 1),
        publishStartTemplate('//publish-id2', '//publishJob-id2'),
        progressStepsTemplate('//publishJob-id2', 1, true),
        publishStartTemplate('//publish-id3', '//publishJob-id3'),
        progressStepsTemplate('//publishJob-id3', 1, true)
      ]);

      const queue = makeQueue();

      await queue.publish(item1);
      await queue.publish(item2);
      await queue.publish(item3);

      await queue.waitForAll();

      expect(queue.failedJobs.length).toEqual(2);
      expect(queue.failedJobs[0].item).toEqual(item2);
      expect(queue.failedJobs[1].item).toEqual(item3);
      expect(totalPolls).toEqual(3);
      expect(totalRequests).toEqual(6);
    });

    it('should still correctly waitForAll if a previous publish is waiting to start', async () => {
      const items = multiMock(10, 1); // 10 items, return success on the first poll (instant publish)

      const queue = makeQueue();

      for (let i = 0; i < items.length; i++) {
        // Deliberately avoid waiting after starting the first publish that would have to wait.
        // This is an unlikely situation, but handling it consistently is useful.

        if (i < 5) {
          await queue.publish(items[i]);
        } else {
          queue.publish(items[i]);
        }
      }

      await queue.waitForAll();

      expect(totalPolls).toEqual(10);
    });

    it('should error publishes when waiting for a publish job exceeds the maxAttempts number', async () => {
      const items = multiMock(3, 5); // 3 items, return success on the 5th poll (after our limit)

      const queue = makeQueue(); // After 1 concurrent request, start waiting.
      queue.maxAttempts = 2; // Fail after 2 incomplete polls.

      for (let i = 0; i < items.length; i++) {
        await queue.publish(items[i]);

        if (queue.failedJobs.length > 0) {
          // The first job should have failed.
          expect(i).toEqual(1); // We only waited for the first job after the second was put in the queue.
          expect(queue.failedJobs[0].item).toBe(items[0]);
          break;
        }

        expect(i).toBeLessThan(1);
      }

      await queue.waitForAll();

      expect(totalPolls).toEqual(4); // 2 total publish requests. 2 waits before each before giving up.
      expect(queue.failedJobs.length).toEqual(2);
    });
  });
});
