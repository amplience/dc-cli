/* eslint-disable @typescript-eslint/camelcase */
import dynamicContentClientFactory from './dynamic-content-client-factory';
import { DynamicContent } from 'dc-management-sdk-js';

jest.mock('dc-management-sdk-js');

describe('dynamic-content-client-factory', function() {
  const resetEnv = (): void => {
    delete process.env.API_URL;
    delete process.env.AUTH_URL;
  };
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('should create a new DynamicContent client', () => {
    const dynamicContent = dynamicContentClientFactory({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      hubId: 'hub-id'
    });
    expect(dynamicContent).toBeInstanceOf(DynamicContent);
    expect(DynamicContent).toHaveBeenCalledWith({ client_id: 'client-id', client_secret: 'client-secret' }, {});
  });

  it('should create a new DynamicContent client using the supplied env vars', () => {
    process.env.API_URL = 'API_URL';
    process.env.AUTH_URL = 'AUTH_URL';

    const dynamicContent = dynamicContentClientFactory({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      hubId: 'hub-id'
    });
    expect(dynamicContent).toBeInstanceOf(DynamicContent);
    expect(DynamicContent).toHaveBeenCalledWith(
      { client_id: 'client-id', client_secret: 'client-secret' },
      {
        apiUrl: 'API_URL',
        authUrl: 'AUTH_URL'
      }
    );
  });
});
