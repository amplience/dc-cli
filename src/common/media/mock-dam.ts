import { DefaultApiClient, ApiClient, AssetListRequest } from 'dam-management-sdk-js';
import { AssetsList } from 'dam-management-sdk-js/build/main/lib/model/Asset';

export class MockDAM {
  static throwOnGetSettings = false;
  static returnNullEndpoint = false;
  static throwOnAssetList = false;
  static missingAssetList = false;

  static requests: AssetListRequest[] = [];

  client: ApiClient;

  settings = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (): Promise<any> => {
      if (MockDAM.throwOnGetSettings) {
        throw new Error('Simulated settings error.');
      }

      if (MockDAM.returnNullEndpoint) {
        return Promise.resolve({
          di: {
            endpoints: [],
            defaultEndpoint: null
          }
        });
      } else {
        return Promise.resolve({
          di: {
            endpoints: [
              {
                id: 'test-endpoint',
                path: 'test-endpoint-path',
                dynamicHost: 'test-endpoint-dynamicHost'
              }
            ],
            defaultEndpoint: 'test-endpoint'
          }
        });
      }
    }
  };

  assets = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    list: (query: AssetListRequest): Promise<AssetsList> => {
      MockDAM.requests.push(query);

      if (MockDAM.throwOnAssetList) {
        throw new Error('Simulated asset list error.');
      }

      let list: AssetsList;

      if (MockDAM.missingAssetList) {
        list = new AssetsList({
          data: [],
          count: 0
        });
      } else {
        const nameStart = (query.q as string).indexOf('/');
        const nameEnd = (query.q as string).lastIndexOf('/');
        const name = (query.q as string).substring(nameStart + 1, nameEnd);

        const names = name.split('|');

        list = new AssetsList({
          data: names.map(name => ({
            id: name,
            name
          })),
          count: names.length
        });
      }

      list.setClient(this.client);

      return Promise.resolve(list);
    }
  };

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.client = new DefaultApiClient('', null as any, null as any);
  }
}
