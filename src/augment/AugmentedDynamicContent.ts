/* eslint-disable @typescript-eslint/camelcase */
import {
  HalClient,
  DefaultHalClient,
  HttpClient,
  AxiosHttpClient,
  AccessTokenProvider,
  OAuth2ClientCredentials,
  OAuth2Client
} from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../commands/configure';
import { PublishingHub } from './model/PublishingHub';

export class AugmentedDynamicContent {
  private baseUrl: string;
  private authUrl: string;
  private client: HalClient;
  private accessTokenProvider: AccessTokenProvider;
  private httpClient: HttpClient;

  constructor(config: ConfigurationParameters) {
    this.baseUrl = process.env.API_URL || 'https://api.amplience.net/v2/content';
    this.authUrl = process.env.AUTH_URL || 'https://auth.amplience.net';

    this.httpClient = new AxiosHttpClient({});

    this.accessTokenProvider = this.createTokenClient(
      this.authUrl,
      {
        client_id: config.clientId,
        client_secret: config.clientSecret
      } as OAuth2ClientCredentials,
      this.httpClient
    );

    this.client = new DefaultHalClient(this.baseUrl, this.httpClient, this.accessTokenProvider);
  }

  protected createTokenClient(
    authUrl: string,
    clientCredentials: OAuth2ClientCredentials,
    httpClient: HttpClient
  ): AccessTokenProvider {
    return new OAuth2Client(
      clientCredentials,
      {
        authUrl: authUrl
      },
      httpClient
    );
  }

  public readonly publishinghubs = {
    /**
     * Retrieve a hub augmented with operations relating to publishing content items by id
     * @param id hub id, previously generated on creation
     */
    get: (id: string): Promise<PublishingHub> => this.client.fetchResource(`/hubs/${id}`, PublishingHub)
  };
}
