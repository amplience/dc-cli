import { AxiosRequestConfig } from 'axios';
import { ApiClient, DefaultApiClient } from './api/services/ApiClient';
import { ApiEndpoints } from './api/services/ApiEndpoints';
import { AxiosHttpClient } from './http/AxiosHttpClient';
import { HttpClient } from './http/HttpClient';
import { AccessTokenProvider } from './oauth2/models/AccessTokenProvider';
import { OAuth2ClientCredentials } from './oauth2/models/OAuth2ClientCredentials';
import { OAuth2Client } from './oauth2/services/OAuth2Client';

/**
 * Configuration settings for DAM API client. You can optionally
 * override these values with environment specific values.
 */
export interface ContentHubConfig {
  /**
   * URL used to connect to the Amplience DAM API.
   * This property defaults to 'https://dam-api.amplience.net/v1.5.0' if not provided
   */
  apiUrl?: string;

  /**
   * URL used to connect to the Amplience OAuth API.
   * This property defaults to 'https://auth.amplience.net' if not provided
   */
  authUrl?: string;
}

export class ContentHub {
  /**
   * Asset Resources
   */
  public assets: ApiEndpoints['assets'];

  /**
   * DAM Settings
   */
  public settings: ApiEndpoints['settings'];

  /**
   * @hidden
   */
  private client: ApiClient;

  /**
   * Creates a Dynamic Content API client instance. You must provide credentials that will
   * be used to authenticate with the API.
   *
   * @param clientCredentials Api credentials used to generate an authentication token
   * @param damConfig Optional configuration settings for Dynamic Content
   * @param clientConfig Optional request settings, can be used to provide proxy settings, add interceptors etc
   */
  constructor(
    clientCredentials: OAuth2ClientCredentials,
    damConfig?: ContentHubConfig,
    httpClient?: AxiosRequestConfig | HttpClient
  ) {
    damConfig = damConfig || {};
    damConfig.apiUrl = damConfig.apiUrl || 'https://dam-api.amplience.net/v1.5.0';
    damConfig.authUrl = damConfig.authUrl || 'https://auth.amplience.net';

    let httpClientInstance: HttpClient;
    if (httpClient !== undefined && 'request' in httpClient) {
      httpClientInstance = httpClient as HttpClient;
    } else {
      httpClientInstance = new AxiosHttpClient(httpClient === undefined ? {} : (httpClient as AxiosRequestConfig));
    }

    const tokenClient = this.createTokenClient(damConfig, clientCredentials, httpClientInstance);

    this.client = this.createResourceClient(damConfig, tokenClient, httpClientInstance);

    this.initEndpoints();
  }

  protected createTokenClient(
    damConfig: ContentHubConfig,
    clientCredentials: OAuth2ClientCredentials,
    httpClient: HttpClient
  ): AccessTokenProvider {
    return new OAuth2Client(
      clientCredentials,
      {
        authUrl: damConfig.authUrl
      },
      httpClient
    );
  }

  protected createResourceClient(
    damConfig: ContentHubConfig,
    tokenProvider: AccessTokenProvider,
    httpClient: HttpClient
  ): ApiClient {
    return new DefaultApiClient(damConfig.apiUrl as string, httpClient, tokenProvider);
  }

  private initEndpoints(): void {
    this.assets = this.client.endpoints.assets;
    this.settings = this.client.endpoints.settings;
  }
}
