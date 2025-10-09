import { ContentItem } from 'dc-management-sdk-js';

import { getIndependentContentItems } from './get-independent-content-items';

describe('getIndependentContentItems', () => {
  it('should return the same number of content items when only unique content items supplied', () => {
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

    expect(getIndependentContentItems([contentItemA, contentItemB])).toEqual([contentItemA, contentItemB]);
  });

  it('should filter content items if they already existing in another content items immediate graph', () => {
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
        text: 'Content item B text',
        linkedText: {
          _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
          contentType: 'http://bigcontent.io/cms/schema/v1/text',
          id: 'c5b659df-680e-4711-bfbe-333333333333'
        }
      }
    });
    const contentItemC = new ContentItem({
      id: 'c5b659df-680e-4711-bfbe-333333333333',
      label: 'Content item C',
      body: {
        _meta: {
          schema: 'http://bigcontent.io/cms/schema/v1/text'
        },
        text: 'Content item C text'
      }
    });

    expect(getIndependentContentItems([contentItemA, contentItemB, contentItemC])).toEqual([
      contentItemA,
      contentItemB
    ]);
  });
});
