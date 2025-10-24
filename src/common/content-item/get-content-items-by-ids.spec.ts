import { ContentItem, DynamicContent } from 'dc-management-sdk-js';

import { getContentByIds } from './get-content-items-by-ids';

describe('getContentByIds', () => {
  it('should get content items for the ids provided', async () => {
    const contentItemA = new ContentItem({
      id: 'c5b659df-680e-4711-bfbe-111111111111',
      label: 'Content item A',
      body: {
        _meta: {
          schema: 'http://bigcontent.io/cms/schema/v1/text'
        },
        text: 'Content item A text'
      }
    });
    const contentItemB = new ContentItem({
      id: 'c5b659df-680e-4711-bfbe-222222222222',
      label: 'Content item B',
      body: {
        _meta: {
          schema: 'http://bigcontent.io/cms/schema/v1/text'
        },
        text: 'Content item B text'
      }
    });
    const mockClient = {
      contentItems: {
        get: jest.fn().mockResolvedValueOnce(contentItemA).mockResolvedValueOnce(contentItemB)
      }
    } as unknown as DynamicContent;

    const ids = ['c5b659df-680e-4711-bfbe-111111111111', 'c5b659df-680e-4711-bfbe-222222222222'];
    const result = await getContentByIds(mockClient, ids);

    expect(result).toEqual([contentItemA, contentItemB]);
  });
  it('should ignore error if a supplied id is missing', async () => {
    const mockClient = {
      contentItems: {
        get: jest.fn().mockRejectedValue(new Error('Authorization required.'))
      }
    } as unknown as DynamicContent;

    const ids = ['c5b659df-680e-4711-bfbe-111111111111'];

    const result = await getContentByIds(mockClient, ids);

    expect(result).toEqual([]);
  });
});
