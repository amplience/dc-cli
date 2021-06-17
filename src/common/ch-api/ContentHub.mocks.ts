/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { AxiosRequestConfig } from 'axios';
import { ContentHub, ContentHubConfig } from './ContentHub';
import { ApiClient } from './api/services/ApiClient';
import { AxiosHttpClient } from './http/AxiosHttpClient';
import { HttpClient } from './http/HttpClient';
import { AccessTokenProvider } from './oauth2/models/AccessTokenProvider';
import { OAuth2ClientCredentials } from './oauth2/models/OAuth2ClientCredentials';

/**
 * @hidden
 */
import MockAdapter from 'axios-mock-adapter';
import { DAMFixtures } from './_fixtures/ContentHubFixtures.mocks';
import { AccessToken } from 'dc-management-sdk-js';

/**
 * @hidden
 */
export class MockContentHub extends ContentHub {
  public mock: MockAdapter;
  public mockClient: ApiClient;

  constructor(
    clientCredentials?: OAuth2ClientCredentials,
    damConfig?: ContentHubConfig,
    httpClient?: AxiosRequestConfig
  ) {
    super(
      clientCredentials || {
        client_id: 'client_id',
        client_secret: 'client_secret'
      },
      damConfig,
      httpClient
    );
  }

  protected createTokenClient(
    damConfig: ContentHubConfig,
    clientCredentials: OAuth2ClientCredentials,
    httpClient: HttpClient
  ): AccessTokenProvider {
    return {
      getToken: (): Promise<AccessToken> =>
        Promise.resolve({
          access_token: 'token',
          expires_in: 60,
          refresh_token: 'refresh'
        })
    };
  }

  protected createResourceClient(
    damConfig: ContentHubConfig,
    tokenProvider: AccessTokenProvider,
    httpClient: HttpClient
  ): ApiClient {
    const client = super.createResourceClient(damConfig, tokenProvider, httpClient);
    this.mock = new MockAdapter((httpClient as AxiosHttpClient).client);
    this.mockClient = client;
    DAMFixtures.install(this.mock);
    return client;
  }
}
