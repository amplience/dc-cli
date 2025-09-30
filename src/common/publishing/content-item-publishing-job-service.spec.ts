import { DynamicContent, PublishingJob } from 'dc-management-sdk-js';
import { PublishingJobStatus } from 'dc-management-sdk-js/build/main/lib/model/PublishingJobStatus';
import { ContentItemPublishingJobService } from './content-item-publishing-job-service';

jest.mock('../burstable-queue/burstable-queue', () => ({
  BurstableQueue: jest.fn().mockImplementation(() => ({
    add: (fn: () => Promise<void>) => fn(),
    onIdle: async () => Promise.resolve()
  }))
}));

const mockClient: {
  publishingJob: {
    get: jest.Mock<Promise<PublishingJob>, [string]>;
  };
} = {
  publishingJob: {
    get: jest.fn()
  }
};

describe('ContentItemPublishingJobService', () => {
  let service: ContentItemPublishingJobService;
  const baseJob = { id: 'job1' } as PublishingJob;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentItemPublishingJobService(mockClient as unknown as DynamicContent);
  });

  it('calls callback when job completes', async () => {
    (mockClient.publishingJob.get as jest.Mock).mockResolvedValue({ ...baseJob, state: PublishingJobStatus.COMPLETED });

    const cb = jest.fn();
    await service.check(baseJob, cb);
    await service.onIdle();

    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ state: PublishingJobStatus.COMPLETED }));
  });

  it('calls callback when job fails', async () => {
    (mockClient.publishingJob.get as jest.Mock).mockResolvedValue({ ...baseJob, state: PublishingJobStatus.FAILED });

    const cb = jest.fn();
    await service.check(baseJob, cb);
    await service.onIdle();

    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ state: PublishingJobStatus.FAILED }));
  });

  it('retries until job is done', async () => {
    (mockClient.publishingJob.get as jest.Mock)
      .mockResolvedValueOnce({ ...baseJob, state: PublishingJobStatus.PREPARING })
      .mockResolvedValueOnce({ ...baseJob, state: PublishingJobStatus.COMPLETED });

    const cb = jest.fn();
    await service.check(baseJob, cb);
    await service.onIdle();

    expect(cb).toHaveBeenCalledTimes(1);
  });
});
