/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpClient } from '../../http/HttpClient';
import { HttpError } from '../../http/HttpError';
import { HttpMethod, HttpRequest } from '../../http/HttpRequest';
import { HttpResponse } from '../../http/HttpResponse';
import { AccessTokenProvider } from '../../oauth2/models/AccessTokenProvider';
import { combineURLs } from '../../utils/URL';
import { ApiResource, ApiResourceConstructor } from '../model/ApiResource';
import { ApiEndpoints } from './ApiEndpoints';
import { CURIEs } from './CURIEs';

/**
 * @hidden
 */
export interface ApiClient {
  endpoints: ApiEndpoints;

  fetchRawResource<T>(path: string, params: ApiParameters): Promise<T>;

  fetchResource<T extends ApiResource>(
    path: string,
    params: ApiParameters,
    resourceConstructor: ApiResourceConstructor<T>
  ): Promise<T>;

  createResource<T extends ApiResource>(
    path: string,
    resource: T,
    params: ApiParameters,
    resourceConstructor: ApiResourceConstructor<T>
  ): Promise<T>;

  updateResource<T extends ApiResource>(
    path: string,
    resource: T,
    params: ApiParameters,
    resourceConstructor: ApiResourceConstructor<T>
  ): Promise<T>;

  genericRequest<T extends ApiResource>(
    path: string,
    method: HttpMethod,
    body: any,
    params: ApiParameters,
    resourceConstructor?: ApiResourceConstructor<T>
  ): Promise<T>;

  parse<T extends ApiResource>(data: any, resourceConstructor: ApiResourceConstructor<T>): T;

  serialize<T>(data: T): any;

  deleteResource(path: string, params: ApiParameters): Promise<void>;
}

/**
 * Query and header parameters used in a resource request.
 */
export interface ApiParameters {
  header?: any;
  query?: any;
}

/**
 * @hidden
 */
export class DefaultApiClient implements ApiClient {
  endpoints: ApiEndpoints;

  constructor(private baseUrl: string, private httpClient: HttpClient, private tokenProvider: AccessTokenProvider) {
    this.endpoints = new ApiEndpoints(this);
  }

  public async fetchRawResource<T>(path: string, params: ApiParameters): Promise<T> {
    path = CURIEs.expand(path, params.query);
    path = path.replace(/%20/g, '+'); // Convert space to +

    const response = await this.invoke({
      method: HttpMethod.GET,
      url: path
    });
    return (response.data as any) as T;
  }

  public async fetchResource<T extends ApiResource>(
    path: string,
    params: ApiParameters,
    resourceConstructor: ApiResourceConstructor<T>
  ): Promise<T> {
    const data = await this.fetchRawResource<any>(path, params);
    return this.parse(data, resourceConstructor);
  }

  public async createResource<T extends ApiResource>(
    path: string,
    resource: T,
    params: ApiParameters,
    resourceConstructor: ApiResourceConstructor<T>
  ): Promise<T> {
    path = CURIEs.expand(path, params.query);
    const response = await this.invoke({
      data: this.serialize(resource),
      method: HttpMethod.POST,
      url: path
    });
    return this.parse(response.data, resourceConstructor);
  }

  public async updateResource<T extends ApiResource>(
    path: string,
    resource: T,
    params: ApiParameters,
    resourceConstructor: ApiResourceConstructor<T>
  ): Promise<T> {
    path = CURIEs.expand(path, params.query);
    const response = await this.invoke({
      data: this.serialize(resource),
      method: HttpMethod.PATCH,
      url: path
    });
    return this.parse(response.data, resourceConstructor);
  }

  public async genericRequest<T extends ApiResource>(
    path: string,
    method: HttpMethod,
    body: any,
    params: ApiParameters,
    resourceConstructor: ApiResourceConstructor<T>
  ): Promise<T> {
    path = CURIEs.expand(path, params.query);
    const response = await this.invoke({
      data: body,
      method,
      url: path
    });
    return this.parse(response.data, resourceConstructor);
  }

  public async deleteResource(path: string, params: ApiParameters): Promise<void> {
    path = CURIEs.expand(path, params.query);
    await this.invoke({
      method: HttpMethod.DELETE,
      url: path
    });
    return Promise.resolve();
  }

  public parse<T extends ApiResource>(data: any, resourceConstructor: ApiResourceConstructor<T>): T {
    const instance: T = new resourceConstructor(data);
    instance.setClient(this);
    return instance;
  }

  public serialize<T>(data: T): any {
    return JSON.parse(JSON.stringify(data));
  }

  protected transformDamResponse(data: any): any {
    // Parse DAM response. All responses are in a common format.

    if (data.status !== 'success') {
      throw new Error(`Request failed with status ${data.status}: ${JSON.stringify(data.content)}`);
    }

    return data.content;
  }

  public async invoke(request: HttpRequest): Promise<HttpResponse> {
    const token = await this.tokenProvider.getToken();

    const fullRequest: HttpRequest = {
      data: request.data,
      headers: {
        'X-Amp-Auth': token.access_token,
        ...request.headers
      },
      method: request.method,
      url: combineURLs(this.baseUrl, request.url)
    };

    return this.httpClient.request(fullRequest).then(response => {
      if (response.status >= 200 && response.status < 300) {
        if (typeof response.data === 'string') {
          response.data = JSON.parse(response.data);
        }
        response.data = this.transformDamResponse(response.data);
        return response;
      } else {
        throw new HttpError(
          `Request failed with status code ${response.status}: ${JSON.stringify(response.data)}`,
          fullRequest,
          response
        );
      }
    });
  }
}
