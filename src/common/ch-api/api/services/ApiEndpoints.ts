import { Asset, AssetsList, AssetsPage } from '../../model/Asset';
import { AssetListRequest } from '../../model/AssetListRequest';
import { Settings } from '../../model/Settings';
import { ApiClient } from './ApiClient';

export class ApiEndpoints {
  constructor(private client: ApiClient) {}

  private assetsListToSingle(list: AssetsList, id: string): Asset {
    const items = list.getItems();

    if (items.length === 0) {
      throw new Error(`Unable to find asset with id ${id}.`);
    }

    return items[0];
  }

  /**
   * Asset Resources
   */
  public readonly assets = {
    /**
     * Retrieve an asset resource by id
     * @param id asset id, previously generated on creation
     */
    get: async (id: string): Promise<Asset> => {
      return this.assetsListToSingle(await this.client.fetchResource(`/assets/${id}`, {}, AssetsList), id);
    },

    /**
     * Retrieve a list of asset resources shared with your client credentials.
     * @param options Pagination options
     */
    list: (options?: AssetListRequest): Promise<AssetsPage> => {
      return this.client.fetchResource(
        '/assets{?q,filter,c,n,s,f,bucket,select,variants,preferredLocales,snippetSize,hl.fl,hl.pre,hl.post,hl.max,localeGroups.collapse,localeGroups.preferredLocales,localeGroups.limit,sort}',
        //
        { query: options },
        AssetsPage
      );
    }
  };

  /**
   * DAM Settings
   */
  public readonly settings = {
    /**
     * Retrieve settings for the DAM account.
     */
    get: (): Promise<Settings> => this.client.fetchResource(`/settings`, {}, Settings)
  };
}
