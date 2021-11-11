import { ContentItem, ContentRepository, Folder, Hub, Status } from 'dc-management-sdk-js';
import * as facetContentModule from './fetch-content';
import * as facetModule from './facet';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import MockPage from '../dc-management-sdk-js/mock-page';

jest.mock('../../services/dynamic-content-client-factory');

const config = {
  clientId: 'client-id',
  clientSecret: 'client-id',
  hubId: 'hub-id'
};

describe('fetch-content', () => {
  describe('tryFetchContent tests', () => {
    const params = {
      folderId: 'folder',
      repoId: 'repo'
    };

    beforeEach((): void => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentItems: {
          get: jest.fn()
        }
      });
    });

    afterEach((): void => {
      jest.restoreAllMocks();
    });

    // the big one...

    // should return null if no fields can be used in a facet request (not including folder/repo/status)
    // should add schema query to field if an exact match array can be extracted
    // should add locale query to field if an exact match array can be extracted
    // should add name to field if an array can be extracted with length one
    // should not add name to field if an array can be extracted, but its length is greater than one
    // should add last modified date to field if present
    // should prefer status from params to the one in the facet object
    // should request full versions of items individually when enrichItems is true

    it('should return null if no fields can be used in a facet request (not including folder/repo/status)', async () => {
      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      hub.related.contentItems.facet = jest.fn().mockResolvedValue(null);

      // None of these facets are able to be added to the query. (status is added only if others exist)
      const facet = {
        status: 'ACTIVE',
        schema: '/inexact/',
        locale: '/inexact/'
      };

      // params added only after other facets exist.

      expect(await facetContentModule.tryFetchContent(client, hub, facet, params)).toBeNull();

      expect(client.contentItems.get).not.toHaveBeenCalled();
      expect(hub.related.contentItems.facet).not.toHaveBeenCalled();
    });

    it('should add schema query to field if an exact match array can be extracted', async () => {
      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      const item1 = new ContentItem({ label: 'item1' });
      hub.related.contentItems.facet = jest.fn().mockResolvedValue(new MockPage(ContentItem, [item1]));

      const facet = {
        status: 'ACTIVE',
        schema: '/^http\\:\\/\\/schema1$|^http\\:\\/\\/schema2$/'
      };

      expect(await facetContentModule.tryFetchContent(client, hub, facet, params)).toEqual([item1]);

      expect(hub.related.contentItems.facet).toHaveBeenCalledWith(
        {
          fields: [
            {
              facetAs: 'ENUM',
              field: 'schema',
              filter: {
                type: 'IN',
                values: ['http://schema1', 'http://schema2']
              }
            }
          ],
          returnEntities: true
        },
        { query: 'contentRepositoryId:"repo"folderId:"folder"status:"ACTIVE"', size: expect.any(Number) }
      );
      expect(client.contentItems.get).not.toHaveBeenCalled();
    });

    it('should add locale query to field if an exact match array can be extracted', async () => {
      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      const item1 = new ContentItem({ label: 'item1' });
      hub.related.contentItems.facet = jest.fn().mockResolvedValue(new MockPage(ContentItem, [item1]));

      const facet = {
        status: 'ACTIVE',
        locale: '/^en\\-GB$|^en\\-US$/'
      };

      expect(await facetContentModule.tryFetchContent(client, hub, facet, params)).toEqual([item1]);

      expect(hub.related.contentItems.facet).toHaveBeenCalledWith(
        {
          fields: [
            {
              facetAs: 'ENUM',
              field: 'locale',
              filter: {
                type: 'IN',
                values: ['en-GB', 'en-US']
              }
            }
          ],
          returnEntities: true
        },
        { query: 'contentRepositoryId:"repo"folderId:"folder"status:"ACTIVE"', size: expect.any(Number) }
      );
      expect(client.contentItems.get).not.toHaveBeenCalled();
    });

    it('should add name to field if an array can be extracted with length one', async () => {
      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      const item1 = new ContentItem({ label: 'item1' });
      hub.related.contentItems.facet = jest.fn().mockResolvedValue(new MockPage(ContentItem, [item1]));

      const facet = {
        status: 'ACTIVE',
        name: '/name \\"partial\\" match/'
      };

      expect(await facetContentModule.tryFetchContent(client, hub, facet, params)).toEqual([item1]);

      expect(hub.related.contentItems.facet).toHaveBeenCalledWith(
        {
          fields: [],
          returnEntities: true
        },
        {
          query: 'label:"name \\"partial\\" match"contentRepositoryId:"repo"folderId:"folder"status:"ACTIVE"',
          size: expect.any(Number)
        }
      );
      expect(client.contentItems.get).not.toHaveBeenCalled();
    });

    it('should not add name to field if an array can be extracted, but its length is greater than one', async () => {
      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      hub.related.contentItems.facet = jest.fn().mockResolvedValue(null);

      const facet = {
        status: 'ACTIVE',
        name: '/multiple|names/'
      };

      expect(await facetContentModule.tryFetchContent(client, hub, facet, params)).toBeNull();

      expect(client.contentItems.get).not.toHaveBeenCalled();
      expect(hub.related.contentItems.facet).not.toHaveBeenCalled();
    });

    it('should add last modified date to field if present', async () => {
      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      const item1 = new ContentItem({ label: 'item1' });
      hub.related.contentItems.facet = jest.fn().mockResolvedValue(new MockPage(ContentItem, [item1]));

      const facet = {
        status: 'ACTIVE',
        lastModifiedDate: 'Last 7 days' as facetModule.DatePreset
      };

      expect(await facetContentModule.tryFetchContent(client, hub, facet, params)).toEqual([item1]);

      expect(hub.related.contentItems.facet).toHaveBeenCalledWith(
        {
          fields: [
            {
              facetAs: 'DATE',
              field: 'lastModifiedDate',
              range: { start: 'NOW', end: '-7:DAYS' }
            }
          ],
          returnEntities: true
        },
        { query: 'contentRepositoryId:"repo"folderId:"folder"status:"ACTIVE"', size: expect.any(Number) }
      );
      expect(client.contentItems.get).not.toHaveBeenCalled();
    });

    it('should prefer status from params to the one in the facet object', async () => {
      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      const item1 = new ContentItem({ label: 'item1' });
      hub.related.contentItems.facet = jest.fn().mockResolvedValue(new MockPage(ContentItem, [item1]));

      const facet = {
        status: 'ACTIVE',
        name: '/name/'
      };

      const modParams = {
        ...params,
        status: Status.ARCHIVED
      };

      expect(await facetContentModule.tryFetchContent(client, hub, facet, modParams)).toEqual([item1]);

      expect(hub.related.contentItems.facet).toHaveBeenCalledWith(
        {
          fields: [],
          returnEntities: true
        },
        {
          query: 'label:"name"contentRepositoryId:"repo"folderId:"folder"status:"ARCHIVED"',
          size: expect.any(Number)
        }
      );
      expect(client.contentItems.get).not.toHaveBeenCalled();
    });

    it('should request full versions of items individually when enrichItems is true', async () => {
      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      const item1 = new ContentItem({ label: 'item1', id: 'item1' });
      const item2 = new ContentItem({ label: 'item2', id: 'item2' });
      hub.related.contentItems.facet = jest.fn().mockResolvedValue(new MockPage(ContentItem, [item1, item2]));

      const itemEnrich = new ContentItem({ label: 'itemEnrich' });
      (client.contentItems.get as jest.Mock).mockResolvedValue(itemEnrich);

      const facet = {
        name: '/name/'
      };

      const modParams = {
        enrichItems: true
      };

      expect(await facetContentModule.tryFetchContent(client, hub, facet, modParams)).toEqual([itemEnrich, itemEnrich]);

      expect(hub.related.contentItems.facet).toHaveBeenCalledWith(
        {
          fields: [],
          returnEntities: true
        },
        {
          query: 'label:"name"',
          size: expect.any(Number)
        }
      );

      expect(client.contentItems.get).toHaveBeenCalledTimes(2);
      expect(client.contentItems.get).toHaveBeenNthCalledWith(1, 'item1');
      expect(client.contentItems.get).toHaveBeenNthCalledWith(2, 'item2');
    });
  });

  describe('fetchContent tests', () => {
    afterEach((): void => {
      jest.restoreAllMocks();
    });

    it('should fetch items directly from folder if tryFetchContent with folderId fails', async () => {
      jest.spyOn(facetContentModule, 'tryFetchContent').mockResolvedValue(null);

      const item1 = new ContentItem({ label: 'item1' });

      const folder1 = new Folder();
      folder1.related.contentItems.list = jest.fn().mockResolvedValue(new MockPage(ContentItem, [item1]));

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        folders: {
          get: jest.fn().mockResolvedValue(folder1)
        }
      });

      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      const facet = { schema: 'http://amplience.com' };
      const params = {
        folderId: 'folder1',
        enrichItems: false,
        status: Status.ACTIVE
      };

      expect(await facetContentModule.fetchContent(client, hub, facet, params)).toEqual([item1]);

      expect(facetContentModule.tryFetchContent).toHaveBeenCalledWith(client, hub, facet, params);

      expect(client.folders.get).toHaveBeenCalledWith('folder1');
      expect(folder1.related.contentItems.list).toHaveBeenCalled();
    });

    it('should fetch items directly from folder if tryFetchContent with repoId fails', async () => {
      jest.spyOn(facetContentModule, 'tryFetchContent').mockResolvedValue(null);

      const item1 = new ContentItem({ label: 'item1' });

      const repo1 = new ContentRepository();
      repo1.related.contentItems.list = jest.fn().mockResolvedValue(new MockPage(ContentItem, [item1]));

      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentRepositories: {
          get: jest.fn().mockResolvedValue(repo1)
        }
      });

      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      const facet = { schema: 'http://amplience.com' };
      const params = {
        repoId: 'repo1',
        enrichItems: false,
        status: Status.ACTIVE
      };

      expect(await facetContentModule.fetchContent(client, hub, facet, params)).toEqual([item1]);

      expect(facetContentModule.tryFetchContent).toHaveBeenCalledWith(client, hub, facet, params);

      expect(client.contentRepositories.get).toHaveBeenCalledWith('repo1');
      expect(repo1.related.contentItems.list).toHaveBeenCalled();
    });

    it('should fetch items directly from folder if tryFetchContent with hub fails', async () => {
      jest.spyOn(facetContentModule, 'tryFetchContent').mockResolvedValue(null);

      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});

      const item1 = new ContentItem({ label: 'item1' });
      const item2 = new ContentItem({ label: 'item2' });

      const repo1 = new ContentRepository();
      repo1.related.contentItems.list = jest.fn().mockResolvedValue(new MockPage(ContentItem, [item1]));

      const repo2 = new ContentRepository();
      repo2.related.contentItems.list = jest.fn().mockResolvedValue(new MockPage(ContentItem, [item2]));

      hub.related.contentRepositories.list = jest
        .fn()
        .mockResolvedValue(new MockPage(ContentRepository, [repo1, repo2]));

      const facet = { schema: 'http://amplience.com' };
      const params = {
        enrichItems: false,
        status: Status.ACTIVE
      };

      expect(await facetContentModule.fetchContent(client, hub, facet, params)).toEqual([item1, item2]);

      expect(facetContentModule.tryFetchContent).toHaveBeenCalledWith(client, hub, facet, params);
    });

    it('should not make requests if tryFetchContent succeeds', async () => {
      const exampleItem = new ContentItem({ label: 'resultItem' });
      jest.spyOn(facetContentModule, 'tryFetchContent').mockResolvedValue([exampleItem]);

      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      const facet = { schema: 'http://amplience.com' };
      const params = {
        folderId: 'folder1',
        repoId: 'repo1',
        enrichItems: false,
        status: Status.ACTIVE
      };

      expect(await facetContentModule.fetchContent(client, hub, facet, params)).toEqual([exampleItem]);

      expect(facetContentModule.tryFetchContent).toHaveBeenCalledWith(client, hub, facet, params);
    });

    it('should parse the facet from a string if provided as such', async () => {
      const exampleItem = new ContentItem({ label: 'resultItem' });
      jest.spyOn(facetContentModule, 'tryFetchContent').mockResolvedValue([exampleItem]);

      const client = await dynamicContentClientFactory(config);
      const hub = new Hub({});
      const facet = 'schema:http://amplience.com';
      const params = {
        folderId: 'folder1',
        repoId: 'repo1',
        enrichItems: false,
        status: Status.ACTIVE
      };

      expect(await facetContentModule.fetchContent(client, hub, facet, params)).toEqual([exampleItem]);

      expect(facetContentModule.tryFetchContent).toHaveBeenCalledWith(
        client,
        hub,
        { schema: 'http://amplience.com' },
        params
      );
    });
  });

  describe('getContent tests', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nullClient = {} as any;

    afterEach((): void => {
      jest.restoreAllMocks();
    });

    it('should call fetchContent with requested singular folder and repo ids', async () => {
      const exampleItem = new ContentItem({ label: 'resultItem' });
      jest.spyOn(facetContentModule, 'fetchContent').mockResolvedValue([exampleItem]);

      const client = nullClient;
      const hub = new Hub({});
      const commonParams = {
        enrichItems: false,
        status: Status.ACTIVE
      };
      const params = {
        folderId: 'folder1',
        repoId: 'repo1',
        ...commonParams
      };

      expect(await facetContentModule.getContent(client, hub, undefined, params)).toEqual([exampleItem, exampleItem]);

      expect(facetContentModule.fetchContent).toHaveBeenCalledTimes(2);

      expect(facetContentModule.fetchContent).toHaveBeenNthCalledWith(1, client, hub, undefined, {
        folderId: 'folder1',
        ...commonParams
      });

      expect(facetContentModule.fetchContent).toHaveBeenNthCalledWith(2, client, hub, undefined, {
        repoId: 'repo1',
        ...commonParams
      });
    });

    //

    it('should call fetchContent with requested array folder and repo ids', async () => {
      const exampleItem = new ContentItem({ label: 'resultItem' });
      jest.spyOn(facetContentModule, 'fetchContent').mockResolvedValue([exampleItem]);

      const client = nullClient;
      const hub = new Hub({});
      const commonParams = {
        enrichItems: false,
        status: Status.ACTIVE
      };
      const params = {
        folderId: ['folder1', 'folder2'],
        repoId: ['repo1', 'repo2'],
        ...commonParams
      };

      expect(await facetContentModule.getContent(client, hub, undefined, params)).toEqual([
        exampleItem,
        exampleItem,
        exampleItem,
        exampleItem
      ]);

      expect(facetContentModule.fetchContent).toHaveBeenCalledTimes(4);

      expect(facetContentModule.fetchContent).toHaveBeenNthCalledWith(1, client, hub, undefined, {
        folderId: 'folder1',
        ...commonParams
      });

      expect(facetContentModule.fetchContent).toHaveBeenNthCalledWith(2, client, hub, undefined, {
        folderId: 'folder2',
        ...commonParams
      });

      expect(facetContentModule.fetchContent).toHaveBeenNthCalledWith(3, client, hub, undefined, {
        repoId: 'repo1',
        ...commonParams
      });

      expect(facetContentModule.fetchContent).toHaveBeenNthCalledWith(4, client, hub, undefined, {
        repoId: 'repo2',
        ...commonParams
      });
    });

    it('should call fetchContent with no folder/repo id, if none is provided', async () => {
      const exampleItem = new ContentItem({ label: 'resultItem' });
      jest.spyOn(facetContentModule, 'fetchContent').mockResolvedValue([exampleItem]);

      const client = nullClient;
      const hub = new Hub({});
      const commonParams = {
        enrichItems: false,
        status: Status.ACTIVE
      };
      const params = {
        ...commonParams
      };

      expect(await facetContentModule.getContent(client, hub, undefined, params)).toEqual([exampleItem]);

      expect(facetContentModule.fetchContent).toHaveBeenCalledTimes(1);

      expect(facetContentModule.fetchContent).toHaveBeenNthCalledWith(1, client, hub, undefined, commonParams);
    });

    it('should call applyFacet only when facet is defined', async () => {
      const exampleItem = new ContentItem({ label: 'resultItem' });
      jest.spyOn(facetContentModule, 'fetchContent').mockResolvedValue([exampleItem]);
      jest.spyOn(facetModule, 'applyFacet').mockReturnValue([exampleItem]);

      const client = nullClient;
      const hub = new Hub({});
      const facet = { schema: 'http://amplience.com' };
      const commonParams = {
        enrichItems: false,
        status: Status.ACTIVE
      };
      const params = {
        ...commonParams
      };

      expect(await facetContentModule.getContent(client, hub, facet, params)).toEqual([exampleItem]);

      expect(facetContentModule.fetchContent).toHaveBeenCalledTimes(1);
      expect(facetContentModule.fetchContent).toHaveBeenNthCalledWith(1, client, hub, facet, commonParams);

      expect(facetModule.applyFacet).toHaveBeenCalledWith([exampleItem], facet);

      // should not call applyFacet when undefined

      (facetContentModule.fetchContent as jest.Mock).mockClear();
      (facetModule.applyFacet as jest.Mock).mockClear();

      expect(await facetContentModule.getContent(client, hub, undefined, params)).toEqual([exampleItem]);

      expect(facetContentModule.fetchContent).toHaveBeenCalledTimes(1);
      expect(facetContentModule.fetchContent).toHaveBeenNthCalledWith(1, client, hub, undefined, commonParams);

      expect(facetModule.applyFacet).not.toHaveBeenCalled();
    });
  });
});
