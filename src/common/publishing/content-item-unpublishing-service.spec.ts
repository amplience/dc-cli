import { ContentItem, ContentItemPublishingStatus } from 'dc-management-sdk-js';
import { ContentItemUnpublishingService } from './content-item-unpublishing-service';

jest.mock('../burstable-queue/burstable-queue', () => {
  return {
    BurstableQueue: jest.fn().mockImplementation(() => ({
      add: (fn: () => Promise<void>) => fn(),
      onIdle: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

const createMockContentItem = (
  id: string,
  status: ContentItemPublishingStatus = ContentItemPublishingStatus.LATEST
): ContentItem => {
  return {
    id,
    publishingStatus: status,
    related: {
      unpublish: jest.fn().mockImplementationOnce(() => Promise.resolve())
    }
  } as unknown as ContentItem;
};

describe('ContentItemUnpublishingService', () => {
  let service: ContentItemUnpublishingService;

  beforeEach(() => {
    service = new ContentItemUnpublishingService();
  });

  it('unpublishes a published content item', async () => {
    const item = createMockContentItem('item-1');
    const action = jest.fn();

    await service.unpublish(item, action);
    await service.onIdle();

    expect(item.related.unpublish).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not unpublish if content item is already unpublished', async () => {
    const item = createMockContentItem('item-2', ContentItemPublishingStatus.UNPUBLISHED);
    const action = jest.fn();

    await service.unpublish(item, action);
    await service.onIdle();

    expect(item.related.unpublish).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalled();
  });
});
