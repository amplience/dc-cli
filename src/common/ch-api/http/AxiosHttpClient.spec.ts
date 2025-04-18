import { AxiosHttpClient } from './AxiosHttpClient';
import { HttpMethod } from './HttpRequest';

// axios-mock-adaptor's typedefs are wrong preventing calling onGet with 3 args, this is a workaround
/**
 * @hidden
 */
import MockAdapter from 'axios-mock-adapter';

describe('AxiosHttpClient tests', () => {
  test('client should use provided base url', async () => {
    const client = new AxiosHttpClient({
      baseURL: 'http://mywebsite.com'
    });

    const mock = new MockAdapter(client.client);
    mock.onGet('http://mywebsite.com/ping').reply(200, 'pong');

    const response = await client.request({
      method: HttpMethod.GET,
      url: 'http://mywebsite.com/ping'
    });

    expect(response.data).toEqual('pong');
  });

  test('client should return status code', async () => {
    const client = new AxiosHttpClient({});

    const mock = new MockAdapter(client.client);
    mock.onGet('/ping').reply(404);

    const response = await client.request({
      method: HttpMethod.GET,
      url: '/ping'
    });

    expect(response.status).toEqual(404);
  });

  test('client should use provided method', async () => {
    const client = new AxiosHttpClient({});

    const mock = new MockAdapter(client.client);
    mock.onDelete('/resource').reply(200);

    const response = await client.request({
      method: HttpMethod.DELETE,
      url: '/resource'
    });

    expect(response.status).toEqual(200);
  });

  test('client should send form data', async () => {
    const client = new AxiosHttpClient({});

    const mock = new MockAdapter(client.client);
    mock
      .onPost('/oauth/token', 'grant_type=client_credentials&client_id=client_id&client_secret=client_secret')
      .reply(200, {
        access_token: 'token',
        expires_in: 0,
        refresh_token: 'refresh'
      });

    const response = await client.request({
      data: 'grant_type=client_credentials&client_id=client_id&client_secret=client_secret',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      method: HttpMethod.POST,
      url: '/oauth/token'
    });

    expect(response.status).toEqual(200);
  });

  test('client should send JSON data', async () => {
    const client = new AxiosHttpClient({});

    const mock = new MockAdapter(client.client);
    mock
      .onPost('/resource/create', {
        key: 'value'
      })
      .reply(200, {
        access_token: 'token',
        expires_in: 0,
        refresh_token: 'refresh'
      });

    const response = await client.request({
      data: {
        key: 'value'
      },
      headers: {
        'Content-Type': 'application/json'
      },
      method: HttpMethod.POST,
      url: '/resource/create'
    });

    expect(response.status).toEqual(200);
  });

  test('client should retry then succeed when first error has 5xx status', async () => {
    const client = new AxiosHttpClient({});
    const mock = new MockAdapter(client.client);

    mock.onGet('/assets').replyOnce(500).onGet('/assets').replyOnce(200, {
      id: '1234'
    });

    const response = await client.request({
      headers: {
        'Content-Type': 'application/json'
      },
      method: HttpMethod.GET,
      url: '/assets'
    });

    expect(response.status).toBe(200);
    expect(mock.history.get.length).toBe(2);
  });

  test('client should retry then succeed when first error has 429 status', async () => {
    const client = new AxiosHttpClient({});
    const mock = new MockAdapter(client.client);

    mock.onGet('/assets').replyOnce(429).onGet('/assets').replyOnce(200, {
      id: '1234'
    });

    const response = await client.request({
      headers: {
        'Content-Type': 'application/json'
      },
      method: HttpMethod.GET,
      url: '/assets'
    });

    expect(response.status).toBe(200);
    expect(mock.history.get.length).toBe(2);
  });

  test('client should retry then succeed when first error is a network error', async () => {
    const client = new AxiosHttpClient({});
    const mock = new MockAdapter(client.client);

    mock.onGet('/assets').networkErrorOnce().onGet('/assets').replyOnce(200, {
      id: '1234'
    });

    const response = await client.request({
      headers: {
        'Content-Type': 'application/json'
      },
      method: HttpMethod.GET,
      url: '/assets'
    });

    expect(response.status).toBe(200);
    expect(mock.history.get.length).toBe(2);
  });

  test('client should retry then fail after 3 retries', async () => {
    const client = new AxiosHttpClient({});
    const mock = new MockAdapter(client.client);

    mock.onGet('/assets').reply(500);

    const response = await client.request({
      headers: {
        'Content-Type': 'application/json'
      },
      method: HttpMethod.GET,
      url: '/assets'
    });

    expect(response.status).toBe(500);
    expect(mock.history.get.length).toBe(4);
  });
});
