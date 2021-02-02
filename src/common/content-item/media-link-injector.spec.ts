import { ContentItem, ContentRepository } from 'dc-management-sdk-js';
import { MediaLinkInjector } from './media-link-injector';

describe('media-link-injector', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('Media Link Injector', () => {
    it('should identify media links', async () => {
      const repo = new ContentRepository();

      const injector = new MediaLinkInjector([
        {
          repo,
          content: new ContentItem({
            body: {
              _meta: {
                schema: 'https://test-type-1.com'
              },
              image: {
                id: '299ba2ac-aa5b-4c18-81da-f12156ad9622',
                name: 'imageProperty',
                endpoint: 'old',
                defaultHost: 'i1.adis.ws',
                mediaType: 'image',
                _meta: {
                  schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/image-link'
                }
              },
              nested: {
                imageNested: {
                  id: '299ba2ac-aa5b-4c18-81da-f12156ad9622',
                  name: 'imageNested',
                  endpoint: 'old',
                  defaultHost: 'i1.adis.ws',
                  mediaType: 'image',
                  _meta: {
                    schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/image-link'
                  }
                },
                imageArray: [
                  {
                    id: '299ba2ac-aa5b-4c18-81da-f12156ad9622',
                    name: 'imageArray1',
                    endpoint: 'old',
                    defaultHost: 'i1.adis.ws',
                    mediaType: 'image',
                    _meta: {
                      schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/image-link'
                    }
                  },
                  {
                    id: '299ba2ac-aa5b-4c18-81da-f12156ad9622',
                    name: 'imageArray2',
                    endpoint: 'old',
                    defaultHost: 'i1.adis.ws',
                    mediaType: 'image',
                    _meta: {
                      schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/image-link'
                    }
                  }
                ]
              }
            }
          })
        }
      ]);

      expect(injector.all).not.toBeNull();
      expect(injector.all.length).toEqual(1);
      expect(injector.all[0].links.length).toEqual(4);

      expect(injector.all.map(group => group.links.map(link => link.link.name))).toEqual([
        ['imageProperty', 'imageNested', 'imageArray1', 'imageArray2']
      ]);
    });
  });
});
