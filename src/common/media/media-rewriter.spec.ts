import { ContentItem, ContentRepository } from 'dc-management-sdk-js';
import chClientFactory from '../../services/ch-client-factory';
import { RepositoryContentItem } from '../content-item/content-dependancy-tree';
import { MediaLinkInjector } from '../content-item/media-link-injector';
import { MediaRewriter } from './media-rewriter';
import { MockContentHub } from './mock-ch';

jest.mock('../../services/ch-client-factory');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
jest.mock('promise-retry', () => (fn: unknown, options: any): unknown => {
  const retryActual = jest.requireActual('promise-retry');
  options.minTimeout = 0;
  options.maxTimeout = 0;
  return retryActual(fn, options);
});

let exampleLinks: RepositoryContentItem[] = [];

describe('media-link-injector', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    MockContentHub.missingAssetList = false;
    MockContentHub.throwOnGetSettings = false;
    MockContentHub.returnNullEndpoint = false;
    MockContentHub.throwOnAssetList = false;
    MockContentHub.requests = [];

    exampleLinks = [
      {
        repo: new ContentRepository(),
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
    ];

    (chClientFactory as jest.Mock).mockReturnValue(new MockContentHub());
  });

  describe('Media Link Injector', () => {
    it('should rewrite media links', async () => {
      const rewriter = new MediaRewriter({ clientId: '', clientSecret: '', hubId: '' }, exampleLinks);

      const missing = await rewriter.rewrite();

      expect(missing.size).toEqual(0); // 0 assets missing

      expect(MockContentHub.requests).toMatchInlineSnapshot(`
        Array [
          Object {
            "n": 4,
            "q": "(name:/imageProperty|imageNested|imageArray1|imageArray2/)",
          },
        ]
      `);

      // The mock DAM has all IDs equal to names, which lets us distinguish them easily.
      // The IDs will be rewritten to these names if all went well.

      expect(exampleLinks[0].content.body.image.id).toBe('imageProperty');
      expect(exampleLinks[0].content.body.nested.imageNested.id).toBe('imageNested');
      expect(exampleLinks[0].content.body.nested.imageArray[0].id).toBe('imageArray1');
      expect(exampleLinks[0].content.body.nested.imageArray[1].id).toBe('imageArray2');
    });

    it('should do nothing if no assets are provided', async () => {
      const rewriter = new MediaRewriter({ clientId: '', clientSecret: '', hubId: '' }, []);

      const missing = await rewriter.rewrite();

      expect(missing.size).toEqual(0); // 0 assets missing

      expect(MockContentHub.requests.length).toEqual(0);
    });

    it('should ignore media links where content with a matching name does not exist on DAM', async () => {
      MockContentHub.missingAssetList = true;
      const rewriter = new MediaRewriter({ clientId: '', clientSecret: '', hubId: '' }, exampleLinks);

      const results = await rewriter.rewrite();

      expect(results.size).toEqual(4); // All 4 assets missing

      expect(MockContentHub.requests).toMatchInlineSnapshot(`
        Array [
          Object {
            "n": 4,
            "q": "(name:/imageProperty|imageNested|imageArray1|imageArray2/)",
          },
        ]
      `);
    });

    it('should fail when the settings endpoint throws', async () => {
      MockContentHub.throwOnGetSettings = true;
      const rewriter = new MediaRewriter({ clientId: '', clientSecret: '', hubId: '' }, []);

      await expect(rewriter.rewrite()).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Could not obtain settings from DAM. Make sure you have the required permissions. Error: Simulated settings error."`
      );
    });

    it('should fail when the settings do not contain a default endpoint', async () => {
      MockContentHub.returnNullEndpoint = true;
      const rewriter = new MediaRewriter({ clientId: '', clientSecret: '', hubId: '' }, []);

      await expect(rewriter.rewrite()).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Could not find the default endpoint."`
      );
    });

    it('should fail when getting assets does not work a certain number of times in a row', async () => {
      MockContentHub.throwOnAssetList = true;
      const rewriter = new MediaRewriter({ clientId: '', clientSecret: '', hubId: '' }, exampleLinks);

      await expect(rewriter.rewrite()).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Request for assets failed after 3 attempts."`
      );

      expect(MockContentHub.requests).toMatchInlineSnapshot(`
        Array [
          Object {
            "n": 4,
            "q": "(name:/imageProperty|imageNested|imageArray1|imageArray2/)",
          },
          Object {
            "n": 4,
            "q": "(name:/imageProperty|imageNested|imageArray1|imageArray2/)",
          },
          Object {
            "n": 4,
            "q": "(name:/imageProperty|imageNested|imageArray1|imageArray2/)",
          },
        ]
      `);
    });

    it('should make multiple asset requests if the query gets too long (3000 chars)', async () => {
      const expectedCharLimit = 3000;
      const expectedRequests = 3;

      const injector = new MediaLinkInjector(exampleLinks);

      const names = injector.all[0].links.map(x => x.link.name + '0');
      const itemLength = names.join('|').length;

      const itemsNeeded = ((expectedRequests - 0.5) * expectedCharLimit) / itemLength;

      const newLinks: RepositoryContentItem[] = [];
      const template = JSON.stringify(exampleLinks[0]);

      for (let i = 0; i < itemsNeeded; i++) {
        const newLink: RepositoryContentItem = JSON.parse(template);
        newLink.content.body.image.name += i;
        newLink.content.body.nested.imageNested.name += i;
        newLink.content.body.nested.imageArray[0].name += i;
        newLink.content.body.nested.imageArray[1].name += i;

        newLinks[i] = newLink;
      }

      const rewriter = new MediaRewriter({ clientId: '', clientSecret: '', hubId: '' }, newLinks);

      const missing = await rewriter.rewrite();

      expect(missing.size).toEqual(0); // 0 assets missing

      expect(MockContentHub.requests.length).toEqual(expectedRequests); // 3 requests
    });
  });
});
