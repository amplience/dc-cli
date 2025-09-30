import { ContentItem, PublishingJob } from 'dc-management-sdk-js';
import { ContentItemPublishingService } from './content-item-publishing-service';

jest.mock('../burstable-queue/burstable-queue', () => ({
  BurstableQueue: jest.fn().mockImplementation(() => ({
    add: (fn: () => Promise<void>) => fn(),
    onIdle: async () => Promise.resolve(),
    size: () => 0,
    pending: () => 0
  }))
}));

const createMockContentItem = (id: string, jobId: string): ContentItem => {
  const publishJob: PublishingJob = { id: jobId } as PublishingJob;
  const publishLocation = { related: { publishingJob: jest.fn().mockResolvedValue(publishJob) } };
  return {
    id,
    related: { publish: jest.fn().mockResolvedValue(publishLocation) }
  } as unknown as ContentItem;
};

describe('ContentItemPublishingService', () => {
  let service: ContentItemPublishingService;
  let item1: ContentItem;
  let item2: ContentItem;

  beforeEach(() => {
    service = new ContentItemPublishingService();
    item1 = createMockContentItem('item-1', 'job-1');
    item2 = createMockContentItem('item-2', 'job-2');
  });

  it('publishes an item and records the job', async () => {
    const cb = jest.fn();

    await service.publish(item1, cb);
    await service.onIdle();

    expect(cb).toHaveBeenCalledWith(item1, expect.objectContaining({ id: 'job-1' }));
    expect(service.publishJobs.map(j => j.id)).toEqual(['job-1']);
  });

  it('handles multiple publishes', async () => {
    const cb = jest.fn();

    await service.publish(item1, cb);
    await service.publish(item2, cb);
    await service.onIdle();

    expect(cb).toHaveBeenCalledTimes(2);
    expect(service.publishJobs.map(j => j.id)).toEqual(['job-1', 'job-2']);
  });
});
