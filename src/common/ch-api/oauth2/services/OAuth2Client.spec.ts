/* eslint-disable @typescript-eslint/camelcase */
import { AxiosHttpClient } from '../../http/AxiosHttpClient';
import { OAuth2Client } from './OAuth2Client';

// axios-mock-adaptor's typedefs are wrong preventing calling onGet with 3 args, this is a workaround
/**
 * @hidden
 */
import MockAdapter from 'axios-mock-adapter';

describe('OAuth2Client tests', () => {
  test('get token should request a token on the first invocation', async () => {
    const httpClient = new AxiosHttpClient({});
    const client = new OAuth2Client(
      {
        client_id: 'client_id',
        client_secret: 'client_secret'
      },
      {},
      httpClient
    );

    const mock = new MockAdapter(httpClient.client);
    mock
      .onPost(
        'https://auth.amplience.net/oauth/token',
        'grant_type=client_credentials&client_id=client_id&client_secret=client_secret'
      )
      .reply(200, {
        access_token: 'token',
        expires_in: 0,
        refresh_token: 'refresh'
      });

    expect((await client.getToken()).access_token).toEqual('token');
  });

  test('get token should cache tokens', async () => {
    const httpClient = new AxiosHttpClient({});
    const client = new OAuth2Client(
      {
        client_id: 'client_id',
        client_secret: 'client_secret'
      },
      {},
      httpClient
    );

    const mock = new MockAdapter(httpClient.client);
    mock
      .onPost(
        'https://auth.amplience.net/oauth/token',
        'grant_type=client_credentials&client_id=client_id&client_secret=client_secret'
      )
      .reply(200, {
        access_token: 'token',
        expires_in: 60,
        refresh_token: 'refresh'
      });

    const token1 = await client.getToken();

    mock
      .onPost(
        'https://auth.amplience.net/oauth/token',
        'grant_type=client_credentials&client_id=client_id&client_secret=client_secret'
      )
      .reply(200, {
        access_token: 'token2',
        expires_in: 60,
        refresh_token: 'refresh'
      });

    const token2 = await client.getToken();

    expect(token1.access_token).toEqual('token');
    expect(token2.access_token).toEqual('token');
  });

  test('cached tokens should expire', async () => {
    const httpClient = new AxiosHttpClient({});
    const client = new OAuth2Client(
      {
        client_id: 'client_id',
        client_secret: 'client_secret'
      },
      {},
      httpClient
    );

    const mock = new MockAdapter(httpClient.client);
    mock
      .onPost(
        'https://auth.amplience.net/oauth/token',
        'grant_type=client_credentials&client_id=client_id&client_secret=client_secret'
      )
      .reply(200, {
        access_token: 'token',
        expires_in: -60,
        refresh_token: 'refresh'
      });

    const token1 = await client.getToken();

    mock
      .onPost(
        'https://auth.amplience.net/oauth/token',
        'grant_type=client_credentials&client_id=client_id&client_secret=client_secret'
      )
      .reply(200, {
        access_token: 'token2',
        expires_in: 0,
        refresh_token: 'refresh'
      });

    const token2 = await client.getToken();

    expect(token1.access_token).toEqual('token');
    expect(token2.access_token).toEqual('token2');
  });

  test('only one token refresh should be in flight at once', async () => {
    const httpClient = new AxiosHttpClient({});
    const client = new OAuth2Client(
      {
        client_id: 'client_id',
        client_secret: 'client_secret'
      },
      {},
      httpClient
    );

    const mock = new MockAdapter(httpClient.client, { delayResponse: 2000 });

    mock
      .onPost(
        'https://auth.amplience.net/oauth/token',
        'grant_type=client_credentials&client_id=client_id&client_secret=client_secret'
      )
      .replyOnce(200, {
        access_token: 'token',
        expires_in: 0,
        refresh_token: 'refresh'
      });

    const token1 = client.getToken();
    const token2 = client.getToken();

    expect((await token1).access_token).toEqual('token');
    expect((await token2).access_token).toEqual('token');
  });
});
