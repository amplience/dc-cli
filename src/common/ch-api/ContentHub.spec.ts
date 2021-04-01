import { AxiosHttpClient } from 'dc-management-sdk-js';
import { ContentHub } from './ContentHub';

describe('ContentHub tests', () => {
  it('should use the http client given to the constructor', async () => {
    const httpClient = new AxiosHttpClient({});

    // eslint-disable-next-line @typescript-eslint/camelcase
    const ch = new ContentHub({ client_id: '', client_secret: '' }, undefined, httpClient);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ch as any)['client']['httpClient']).toEqual(httpClient);
  });
});
