import { ContentItem } from 'dc-management-sdk-js';
import { findContentDependancyIds } from './find-content-dependencies';

describe('find-content-dependancies', () => {
  describe('findContentDependancyIds', () => {
    it('should return a single dependancy id when passed a content item with a content-link in an array property', () => {
      const contentItem = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-111111111111',
        label: 'Content item 1',
        body: {
          dependencies: [
            {
              _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
              contentType: 'http://bigcontent.io/cms/schema/v1/text',
              id: 'da2ee918-34c3-4fc1-ae05-222222222222'
            }
          ]
        }
      });

      const result = findContentDependancyIds(contentItem.body);

      expect(result).toEqual(['da2ee918-34c3-4fc1-ae05-222222222222']);
    });
    it('should return a single dependancy id when passed a content item with a content-link in an object property', () => {
      const contentItem = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-111111111111',
        label: 'Content item 1',
        body: {
          dependencies: {
            _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
            contentType: 'http://bigcontent.io/cms/schema/v1/text',
            id: 'da2ee918-34c3-4fc1-ae05-222222222222'
          }
        }
      });

      const result = findContentDependancyIds(contentItem.body);

      expect(result).toEqual(['da2ee918-34c3-4fc1-ae05-222222222222']);
    });
    it('should return a multiple dependancy id when passed a content item with multiple dependants', () => {
      const contentItem = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-111111111111',
        label: 'Content item 1',
        body: {
          dependencies: [
            {
              _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
              contentType: 'http://bigcontent.io/cms/schema/v1/text',
              id: 'da2ee918-34c3-4fc1-ae05-222222222222'
            },
            {
              _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
              contentType: 'http://bigcontent.io/cms/schema/v1/text',
              id: 'da2ee918-34c3-4fc1-ae05-333333333333'
            }
          ]
        }
      });

      const result = findContentDependancyIds(contentItem.body);

      expect(result).toEqual(['da2ee918-34c3-4fc1-ae05-222222222222', 'da2ee918-34c3-4fc1-ae05-333333333333']);
    });
    it('should return a multiple dependancy id when passed a content item with dependancy in multiple props', () => {
      const contentItem = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-111111111111',
        label: 'Content item 1',
        body: {
          dependencies: [
            {
              _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
              contentType: 'http://bigcontent.io/cms/schema/v1/text',
              id: 'da2ee918-34c3-4fc1-ae05-222222222222'
            }
          ],
          moreDepenancies: [
            {
              _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
              contentType: 'http://bigcontent.io/cms/schema/v1/text',
              id: 'da2ee918-34c3-4fc1-ae05-333333333333'
            }
          ]
        }
      });

      const result = findContentDependancyIds(contentItem.body);

      expect(result).toEqual(['da2ee918-34c3-4fc1-ae05-222222222222', 'da2ee918-34c3-4fc1-ae05-333333333333']);
    });

    it('should return a multiple dependancy id when passed a content item with dependancy in multiple nested props', () => {
      const contentItem = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-111111111111',
        label: 'Content item 1',
        body: {
          dependencies: [
            {
              _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
              contentType: 'http://bigcontent.io/cms/schema/v1/text',
              id: 'da2ee918-34c3-4fc1-ae05-222222222222'
            }
          ],
          nestedProp: {
            moreDepenancies: [
              {
                _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
                contentType: 'http://bigcontent.io/cms/schema/v1/text',
                id: 'da2ee918-34c3-4fc1-ae05-333333333333'
              }
            ]
          }
        }
      });

      const result = findContentDependancyIds(contentItem.body);

      expect(result).toEqual(['da2ee918-34c3-4fc1-ae05-222222222222', 'da2ee918-34c3-4fc1-ae05-333333333333']);
    });

    it('should return a multiple dependancy ids when passed a content item with dependancy nested in another depenancy', () => {
      const contentItem = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-111111111111',
        label: 'Content item 1',
        body: {
          dependencies: [
            {
              _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
              contentType: 'http://bigcontent.io/cms/schema/v1/text',
              id: 'da2ee918-34c3-4fc1-ae05-222222222222',
              moreDepenancies: [
                {
                  _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
                  contentType: 'http://bigcontent.io/cms/schema/v1/text-nested',
                  id: 'da2ee918-34c3-4fc1-ae05-333333333333'
                }
              ]
            }
          ]
        }
      });

      const result = findContentDependancyIds(contentItem.body);

      expect(result).toEqual(['da2ee918-34c3-4fc1-ae05-222222222222', 'da2ee918-34c3-4fc1-ae05-333333333333']);
    });

    it('should return a empty array when properties do not contain a content dependancy', () => {
      const contentItem = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-111111111111',
        label: 'Content item 1',
        body: {
          dependencies: {
            _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/not-a-content-link' },
            contentType: 'http://bigcontent.io/cms/schema/v1/text',
            id: 'da2ee918-34c3-4fc1-ae05-222222222222'
          }
        }
      });

      const result = findContentDependancyIds(contentItem.body);

      expect(result).toEqual([]);
    });
    it('should return a empty array when `body` is an empty object', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = findContentDependancyIds({} as any);

      expect(result).toEqual([]);
    });
    it('should return a empty array when `body` is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = findContentDependancyIds(undefined as any);

      expect(result).toEqual([]);
    });
  });
});
