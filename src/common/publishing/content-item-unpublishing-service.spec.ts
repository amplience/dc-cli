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

  it('unpublishes a content item that has a status of LATEST', async () => {
    const item = createMockContentItem('item-latest', ContentItemPublishingStatus.LATEST);
    const action = jest.fn();

    await service.unpublish(item, action);
    await service.onIdle();

    expect(item.related.unpublish).toHaveBeenCalled();
    expect(action).toHaveBeenCalled();

    expect(item.related.unpublish).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-latest' }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('unpublishes a content item that has a status of EARLY', async () => {
    const item = createMockContentItem('item-early', ContentItemPublishingStatus.EARLY);
    const action = jest.fn();

    await service.unpublish(item, action);
    await service.onIdle();

    expect(item.related.unpublish).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-early' }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not unpublish if content item has a status of NONE', async () => {
    const item = createMockContentItem('item-none', ContentItemPublishingStatus.NONE);
    const action = jest.fn();

    await service.unpublish(item, action);
    await service.onIdle();

    expect(item.related.unpublish).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalled();
  });

  it('does not unpublish if content item has a status of UNPUBLISHED', async () => {
    const item = createMockContentItem('item-unpublished', ContentItemPublishingStatus.UNPUBLISHED);
    const action = jest.fn();

    await service.unpublish(item, action);
    await service.onIdle();

    expect(item.related.unpublish).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalled();
  });
});
