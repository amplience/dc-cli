import MockAdapter from 'axios-mock-adapter';
import { AxiosHttpClient } from '../../http/AxiosHttpClient';
import { DefaultApiClient } from './ApiClient';
import { OAuth2Client } from '../../oauth2/services/OAuth2Client';
import { HttpMethod } from '../../http/HttpRequest';

describe('ApiClient', () => {
  describe('invoke', () => {
    let axiosClient: AxiosHttpClient;
    let mockClient: MockAdapter;

    beforeEach(() => {
      axiosClient = new AxiosHttpClient({
        baseURL: 'https://api.amplience.net'
      });
      mockClient = new MockAdapter(axiosClient.client, { onNoMatch: 'throwException' });
    });
    test('should return data from 2xx response', async () => {
      mockClient
        .onPost('/oauth/token')
        .replyOnce(200, { access_token: 'test_access_token', refresh_token: 'test_refresh_token', expires_in: 9999 });
      mockClient
        .onGet('/assets')
        .replyOnce(200, { status: 'success', content: { data: [{ srcName: 'Elephant_BW.jpg' }] } });
      const tokenClient = new OAuth2Client(
        { client_id: 'test_id', client_secret: 'test_secret' },
        { authUrl: 'https://api.amplience.net' },
        axiosClient
      );
      const client = new DefaultApiClient('https://api.amplience.net', axiosClient, tokenClient);

      const response = await client.invoke({ url: '/assets', method: HttpMethod.GET });

      expect(response.status).toEqual(200);
      expect(response.data).toEqual({ data: [{ srcName: 'Elephant_BW.jpg' }] });
    });

    test('should return parsed data from 2xx response', async () => {
      mockClient
        .onPost('/oauth/token')
        .replyOnce(200, { access_token: 'test_access_token', refresh_token: 'test_refresh_token', expires_in: 9999 });
      mockClient
        .onGet('/assets')
        .replyOnce(200, '{"status":"success","content":{"data":[{"srcName":"Elephant_BW.jpg"}]}}');
      const tokenClient = new OAuth2Client(
        { client_id: 'test_id', client_secret: 'test_secret' },
        { authUrl: 'https://api.amplience.net' },
        axiosClient
      );
      const client = new DefaultApiClient('https://api.amplience.net', axiosClient, tokenClient);

      const response = await client.invoke({ url: '/assets', method: HttpMethod.GET });

      expect(response.status).toEqual(200);
      expect(response.data).toEqual({ data: [{ srcName: 'Elephant_BW.jpg' }] });
    });

    test('should throw http error with structured message when error contains a status', async () => {
      mockClient
        .onPost('/oauth/token')
        .replyOnce(200, { access_token: 'test_access_token', refresh_token: 'test_refresh_token', expires_in: 9999 });
      mockClient.onGet('/assets').replyOnce(500, {
        error: 'Internal Error',
        status: 'failed'
      });
      const tokenClient = new OAuth2Client(
        { client_id: 'test_id', client_secret: 'test_secret' },
        { authUrl: 'https://api.amplience.net' },
        axiosClient
      );
      const client = new DefaultApiClient('https://api.amplience.net', axiosClient, tokenClient);

      try {
        await client.invoke({ url: '/assets', method: HttpMethod.GET });
      } catch (e) {
        expect(e.message).toEqual(
          'Request failed with status code 500: {\"error\":\"Internal Error\",\"status\":\"failed\"}'
        );
      }
    });

    test('should throw http error when network error encounted', async () => {
      mockClient
        .onPost('/oauth/token')
        .replyOnce(200, { access_token: 'test_access_token', refresh_token: 'test_refresh_token', expires_in: 9999 });
      mockClient.onGet('/assets').networkError();
      const tokenClient = new OAuth2Client(
        { client_id: 'test_id', client_secret: 'test_secret' },
        { authUrl: 'https://api.amplience.net' },
        axiosClient
      );
      const client = new DefaultApiClient('https://api.amplience.net', axiosClient, tokenClient);

      try {
        await client.invoke({ url: '/assets', method: HttpMethod.GET });
      } catch (e) {
        expect(e.message).toEqual('Request failed with no response from server: Network Error');
      }
    });

    test('should throw http error when timeout encounted', async () => {
      mockClient
        .onPost('/oauth/token')
        .replyOnce(200, { access_token: 'test_access_token', refresh_token: 'test_refresh_token', expires_in: 9999 });
      mockClient.onGet('/assets').timeout();
      const tokenClient = new OAuth2Client(
        { client_id: 'test_id', client_secret: 'test_secret' },
        { authUrl: 'https://api.amplience.net' },
        axiosClient
      );
      const client = new DefaultApiClient('https://api.amplience.net', axiosClient, tokenClient);

      try {
        await client.invoke({ url: '/assets', method: HttpMethod.GET });
      } catch (e) {
        expect(e.message).toEqual('Request failed with no response from server: ECONNABORTED timeout of 0ms exceeded');
      }
    });
  });
});
