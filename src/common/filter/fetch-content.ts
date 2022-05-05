import {
  ContentItem,
  DynamicContent,
  FacetedContentItem,
  FacetQuery,
  HalResource,
  Hub,
  Page,
  Status
} from 'dc-management-sdk-js';
import paginator from '../dc-management-sdk-js/paginator';
import { applyFacet, Facet, parseDateRange, parseFacet, tryGetArray } from './facet';
import { isRegexString } from './regex';

// Threshold used to facet enriched content then request individually instead of fetching+filtering all content.
// Currently, facet should return 20 times less content items than a request for all of them to be used.
// If there are less than 20 content items, always facet.
export const facetEnrichThreshold = 20;
export const facetAlwaysMaximum = 20;

interface FetchContentParams {
  enrichItems?: boolean;
  repoId?: string;
  folderId?: string;
  status?: Status;
}

interface GetContentParams {
  enrichItems?: boolean;
  repoId?: string | string[];
  folderId?: string | string[];
  status?: Status;
}

export const getTotalElements = (page: Page<HalResource>): number => {
  if (page.page == null || page.page.totalElements == null) {
    return page.getItems().length;
  }

  return page.page.totalElements;
};

export const getItemCount = async (
  client: DynamicContent,
  hub: Hub,
  folderId: string | undefined,
  repoId: string | undefined,
  status: Status | undefined
): Promise<number> => {
  const options = { status, size: 1 };

  if (folderId != null) {
    const folder = await client.folders.get(folderId);
    return getTotalElements(await folder.related.contentItems.list(options));
  } else if (repoId != null) {
    const repo = await client.contentRepositories.get(repoId);
    return getTotalElements(await repo.related.contentItems.list(options));
  } else {
    const repos = await paginator(hub.related.contentRepositories.list);

    let result = 0;
    for (const repo of repos) {
      const page = await repo.related.contentItems.list(options);
      result += getTotalElements(page);
    }
    return result;
  }
};

export const shouldFacetEnriched = async (
  client: DynamicContent,
  hub: Hub,
  facetQuery: FacetQuery,
  qString: string,
  folderId: string | undefined,
  repoId: string | undefined,
  status: Status | undefined
): Promise<boolean | 0> => {
  const facetCount = getTotalElements(await hub.related.contentItems.facet(facetQuery, { query: qString, size: 1 }));

  if (facetCount == 0) {
    return 0;
  }

  if (facetCount > facetAlwaysMaximum) {
    const allCount = await getItemCount(client, hub, folderId, repoId, status);

    if (facetCount * facetEnrichThreshold >= allCount) {
      return false; // Just get all content items.
    }
  }

  return true;
};

export const tryFetchContent = async (
  client: DynamicContent,
  hub: Hub,
  facet: Facet,
  params: FetchContentParams
): Promise<ContentItem[] | FacetedContentItem[] | null> => {
  const { repoId, folderId, enrichItems, status } = params;
  const facetQuery: FacetQuery = { fields: [], returnEntities: true };
  const query: string[] = [];

  const schemaArray = tryGetArray(facet.schema, true);
  if (schemaArray) {
    facetQuery.fields.push({
      facetAs: 'ENUM',
      field: 'schema',
      filter: {
        type: 'IN',
        values: schemaArray
      }
    });
  }

  const localeArray = tryGetArray(facet.locale, true);
  if (localeArray) {
    facetQuery.fields.push({
      facetAs: 'ENUM',
      field: 'locale',
      filter: {
        type: 'IN',
        values: localeArray
      }
    });
  }

  if (facet.name) {
    const names = tryGetArray(facet.name, false);

    // The facet endpoint cannot search for multiple label values at the moment.
    if (names && names.length === 1) {
      for (const name of names) {
        query.push(`label:"${name.replace(/"/g, '\\"')}"`);
      }
    }
  }

  if (facet.lastModifiedDate) {
    const range = parseDateRange(facet.lastModifiedDate);
    facetQuery.fields.push({
      facetAs: 'DATE',
      field: 'lastModifiedDate',
      filter: {
        type: 'DATE',
        values: [`${range.end},${range.start}`]
      },
      range
    });
  }

  if (facetQuery.fields.length === 0 && query.length === 0) {
    return null;
  }

  if (repoId) {
    query.push(`contentRepositoryId:"${repoId}"`);
  }

  if (folderId) {
    query.push(`folderId:"${folderId}"`);
  }

  if (status) {
    query.push(`status:"${status}"`);
  } else if (facet.status && !isRegexString(facet.status) && facet.status.indexOf('"') === -1) {
    query.push(`status:"${facet.status}"`);
    delete facet.status;
  }

  if (enrichItems) {
    // The facets endpoint does not return the content item body, so it must be requested manually.
    // First, check if it's worth it enriching items individually instead of just fetching them all.
    const qString = query.join('');

    const should = await shouldFacetEnriched(client, hub, facetQuery, qString, folderId, repoId, status);

    if (should === 0) {
      return [];
    } else if (!should) {
      return null;
    }

    const items = await paginator(options =>
      hub.related.contentItems.facet(facetQuery, { ...options, query: qString })
    );
    const enriched: ContentItem[] = [];

    for (let i = 0; i < items.length; i++) {
      enriched.push(await client.contentItems.get(items[i].id));
    }

    return enriched;
  } else {
    return paginator(options => hub.related.contentItems.facet(facetQuery, { ...options, query: query.join('') }));
  }
};

export const fetchContent = async (
  client: DynamicContent,
  hub: Hub,
  facetOrString: Facet | string | undefined,
  params: FetchContentParams
): Promise<ContentItem[]> => {
  const { repoId, folderId, status } = params;

  const options = status ? { status } : undefined;
  let filtered: ContentItem[] | FacetedContentItem[] | null = null;

  if (facetOrString) {
    let facet: Facet;
    if (typeof facetOrString === 'string') {
      facet = parseFacet(facetOrString);
    } else {
      facet = facetOrString;
    }

    filtered = await tryFetchContent(client, hub, facet, params);
  }

  if (filtered == null) {
    if (folderId != null) {
      const folder = await client.folders.get(folderId);

      return await paginator(folder.related.contentItems.list, options);
    } else if (repoId != null) {
      const repo = await client.contentRepositories.get(repoId);

      return await paginator(repo.related.contentItems.list, options);
    } else {
      const repos = await paginator(hub.related.contentRepositories.list);

      const result: ContentItem[] = [];
      for (const repo of repos) {
        result.push(...(await paginator(repo.related.contentItems.list, options)));
      }

      return result;
    }
  }

  return filtered as ContentItem[];
};

export const getContent = async (
  client: DynamicContent,
  hub: Hub,
  facetOrString: Facet | string | undefined,
  params: GetContentParams
): Promise<ContentItem[]> => {
  const result: ContentItem[] = [];
  const { repoId, folderId, enrichItems, status } = params;
  const baseFetchParams = { enrichItems, status };

  if (folderId != null) {
    const folderIds = Array.isArray(folderId) ? folderId : [folderId];
    for (const folder of folderIds) {
      result.push(...(await fetchContent(client, hub, facetOrString, { ...baseFetchParams, folderId: folder })));
    }
  }

  if (repoId != null) {
    const repoIds = Array.isArray(repoId) ? repoId : [repoId];
    for (const repo of repoIds) {
      result.push(...(await fetchContent(client, hub, facetOrString, { ...baseFetchParams, repoId: repo })));
    }
  }

  if (folderId == null && repoId == null) {
    result.push(...(await fetchContent(client, hub, facetOrString, baseFetchParams)));
  }

  return facetOrString ? applyFacet(result, facetOrString) : result;
};
