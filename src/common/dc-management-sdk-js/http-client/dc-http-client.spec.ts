import MockAdapter from 'axios-mock-adapter';
import { HttpMethod } from 'dc-management-sdk-js';

jest.setTimeout(60000);

describe('DCHttpClient tests', () => {
  beforeEach(async () => {
    jest.resetModules();
    process.env.DC_CLI_DELAY_FACTOR = '100';
  });
  afterEach(() => {
    process.env.DC_CLI_DELAY_FACTOR = '';
  });
  test('client should request content', async () => {
    const { DCHttpClient } = await import('./dc-http-client');
    const client = new DCHttpClient({
      baseURL: 'https://api.amplience.net'
    });

    const mock = new MockAdapter(client.client);
    mock.onGet('https://api.amplience.net/resource').reply(200, 'pong');

    const response = await client.request({
      method: HttpMethod.GET,
      url: 'https://api.amplience.net/resource'
    });

    expect(response.data).toEqual('pong');
  });
  test('client should retry then succeed when first error has 5xx status', async () => {
    const { DCHttpClient } = await import('./dc-http-client');
    const client = new DCHttpClient({});
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

  test('client should retry then succeed when first error has 401 status', async () => {
    const { DCHttpClient } = await import('./dc-http-client');
    const client = new DCHttpClient({});
    const mock = new MockAdapter(client.client);

    mock.onGet('/assets').replyOnce(401).onGet('/assets').replyOnce(200, {
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

  test('client should retry then succeed when first error has 403 status', async () => {
    const { DCHttpClient } = await import('./dc-http-client');
    const client = new DCHttpClient({});
    const mock = new MockAdapter(client.client);

    mock.onGet('/assets').replyOnce(403).onGet('/assets').replyOnce(200, {
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
    const { DCHttpClient } = await import('./dc-http-client');
    const client = new DCHttpClient({});
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
    const { DCHttpClient } = await import('./dc-http-client');
    const client = new DCHttpClient({});
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

  test('client should retry 3 times and succeed on the last', async () => {
    const { DCHttpClient } = await import('./dc-http-client');
    const client = new DCHttpClient({});
    const mock = new MockAdapter(client.client);

    mock.onGet('/assets').replyOnce(401);
    mock.onGet('/assets').replyOnce(401);
    mock.onGet('/assets').replyOnce(401);
    mock.onGet('/assets').replyOnce(200, {
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
    expect(mock.history.get.length).toBe(4);
  });

  test('client should retry then fail after 3 retries', async () => {
    const { DCHttpClient } = await import('./dc-http-client');
    const client = new DCHttpClient({});
    const mock = new MockAdapter(client.client);

    mock.onGet('/assets').reply(429);

    const response = await client.request({
      headers: {
        'Content-Type': 'application/json'
      },
      method: HttpMethod.GET,
      url: '/assets'
    });

    expect(response.status).toBe(429);
    expect(mock.history.get.length).toBe(4);
  });

  test('client should retry after connection timeout', async () => {
    const { DCHttpClient } = await import('./dc-http-client');
    const client = new DCHttpClient({});
    const mock = new MockAdapter(client.client);

    mock.onGet('/assets').timeoutOnce();
    mock.onGet('/assets').replyOnce(200, {
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

  test('client should retry after connection timeouts resetting the timout value each retry', async () => {
    const { DCHttpClient } = await import('./dc-http-client');
    const client = new DCHttpClient({ timeout: 1 });
    const mock = new MockAdapter(client.client);

    mock.onGet('/assets').timeoutOnce();
    mock.onGet('/assets').timeoutOnce();
    mock.onGet('/assets').replyOnce(200, {
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
    expect(mock.history.get.length).toBe(3);
  });

  test('client should log a relevant error code and message on client errors', async () => {
    const { DCHttpClient } = await import('./dc-http-client');
    const client = new DCHttpClient({ timeout: 1 });
    const mock = new MockAdapter(client.client);

    mock.onGet('/assets').timeoutOnce();
    mock.onGet('/assets').timeoutOnce();
    mock.onGet('/assets').timeoutOnce();
    mock.onGet('/assets').timeoutOnce();

    const response = await client.request({
      headers: {
        'Content-Type': 'application/json'
      },
      method: HttpMethod.GET,
      url: '/assets'
    });

    expect(response.status).toBe('ECONNABORTED');
    expect(response.data).toEqual({ message: 'timeout of 1ms exceeded' });

    expect(mock.history.get.length).toBe(4);
  });
});
