import { ContentItem, Hub, Job } from 'dc-management-sdk-js';
import { ContentItemSyncService } from './sync.service';

const createMockHub = (id: string) => {
  return { ...new Hub({ id }), ...{ related: { jobs: { createDeepSyncJob: jest.fn(), get: jest.fn() } } } };
};

describe('sync.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('ContentItemSyncService', () => {
    describe('sync', () => {
      it('should add a content item sync job to the queue and process the queue item', async () => {
        const JOB_ID = '68e5289f0aba3024bde050f9';
        const DEST_HUB_ID = '67d2a201642fa239dbe1523d';
        const CONTENT_ITEM_ID = 'c5b659df-680e-4711-bfbe-84eaa10d76cc';
        const contentItem = new ContentItem({ id: CONTENT_ITEM_ID, label: 'sync service test' });
        const hub = createMockHub(CONTENT_ITEM_ID);

        hub.related.jobs.createDeepSyncJob.mockResolvedValue(new Job({ jobId: JOB_ID }));
        hub.related.jobs.get.mockResolvedValue(new Job({ id: JOB_ID, status: 'COMPLETED' }));

        const syncService = new ContentItemSyncService();
        syncService.sync(DEST_HUB_ID, hub as unknown as Hub, contentItem, () => {});
        await syncService.onIdle();

        expect(hub.related.jobs.createDeepSyncJob).toHaveBeenCalledWith({
          label: `dc-cli content item: sync service test`,
          ignoreSchemaValidation: true,
          destinationHubId: DEST_HUB_ID,
          input: { rootContentItemIds: [CONTENT_ITEM_ID] }
        });
        expect(hub.related.jobs.get).toHaveBeenNthCalledWith(1, JOB_ID);
        expect(syncService.failedJobs.length).toEqual(0);
      });
      it('should add a content item sync job to the queue, process and wait for a completed job', async () => {
        const JOB_ID = '68e5289f0aba3024bde050f9';
        const DEST_HUB_ID = '67d2a201642fa239dbe1523d';
        const CONTENT_ITEM_ID = 'c5b659df-680e-4711-bfbe-84eaa10d76cc';
        const contentItem = new ContentItem({ id: CONTENT_ITEM_ID, label: 'sync service test' });
        const hub = createMockHub(CONTENT_ITEM_ID);

        hub.related.jobs.createDeepSyncJob.mockResolvedValue(new Job({ jobId: JOB_ID }));
        hub.related.jobs.get
          .mockResolvedValueOnce(new Job({ id: JOB_ID, status: 'IN_PROGRESS' }))
          .mockResolvedValueOnce(new Job({ id: JOB_ID, status: 'COMPLETED' }));

        const syncService = new ContentItemSyncService();
        syncService.sync(DEST_HUB_ID, hub as unknown as Hub, contentItem, () => {});
        await syncService.onIdle();

        expect(hub.related.jobs.createDeepSyncJob).toHaveBeenCalledWith({
          label: `dc-cli content item: sync service test`,
          ignoreSchemaValidation: true,
          destinationHubId: DEST_HUB_ID,
          input: { rootContentItemIds: [CONTENT_ITEM_ID] }
        });
        expect(hub.related.jobs.get).toHaveBeenNthCalledWith(2, JOB_ID);
        expect(syncService.failedJobs.length).toEqual(0);
      });
      it('should add a content item sync job to the queue, process and store a failed job', async () => {
        const JOB_ID = '68e5289f0aba3024bde050f9';
        const DEST_HUB_ID = '67d2a201642fa239dbe1523d';
        const CONTENT_ITEM_ID = 'c5b659df-680e-4711-bfbe-84eaa10d76cc';
        const contentItem = new ContentItem({ id: CONTENT_ITEM_ID, label: 'sync service test' });
        const hub = createMockHub(CONTENT_ITEM_ID);

        hub.related.jobs.createDeepSyncJob.mockResolvedValue(new Job({ jobId: JOB_ID }));
        hub.related.jobs.get.mockResolvedValueOnce(new Job({ id: JOB_ID, status: 'FAILED' }));

        const syncService = new ContentItemSyncService();
        syncService.sync(DEST_HUB_ID, hub as unknown as Hub, contentItem, () => {});
        await syncService.onIdle();

        expect(hub.related.jobs.createDeepSyncJob).toHaveBeenCalledWith({
          label: `dc-cli content item: sync service test`,
          ignoreSchemaValidation: true,
          destinationHubId: DEST_HUB_ID,
          input: { rootContentItemIds: [CONTENT_ITEM_ID] }
        });
        expect(hub.related.jobs.get).toHaveBeenNthCalledWith(1, JOB_ID);
        expect(syncService.failedJobs.length).toEqual(1);
      });
    });
  });
});
