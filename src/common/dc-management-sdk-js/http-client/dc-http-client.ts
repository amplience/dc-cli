import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry, { IAxiosRetryConfig, isNetworkOrIdempotentRequestError, isRetryableError } from 'axios-retry';
import { HttpClient, HttpRequest, HttpResponse } from 'dc-management-sdk-js';

const DcRetryErrorCodes = [400, 401, 403, 404, 429];

const isRetriableDCResponseError = (error: AxiosError) => {
  return DcRetryErrorCodes.includes(Number(error?.response?.status));
};

const isSafeDCRequestError = (error: AxiosError) => {
  if (!error.config?.method) {
    // Cannot determine if the request can be retried
    return false;
  }

  return isRetryableError(error) && SAFE_HTTP_METHODS.indexOf(error?.config?.method) !== -1;
};

const SAFE_HTTP_METHODS = ['get', 'head', 'options', 'patch', 'post', 'put', 'del'];

const DELAY_FACTOR = Number(process.env.DC_CLI_DELAY_FACTOR) || 1400;
const DEFAULT_RETRY_CONFIG: IAxiosRetryConfig = {
  retries: 3,
  shouldResetTimeout: true,
  retryDelay: (retryCount, error) => axiosRetry.exponentialDelay(retryCount, error, DELAY_FACTOR),
  retryCondition: (error: AxiosError) => {
    return (
      Boolean(error?.code) ||
      isSafeDCRequestError(error) ||
      isNetworkOrIdempotentRequestError(error) ||
      isRetriableDCResponseError(error)
    );
  }
};

/**
 * @hidden
 */
export class DCHttpClient implements HttpClient {
  public client: AxiosInstance;

  constructor(private config: AxiosRequestConfig) {
    this.client = axios.create(config);
    axiosRetry(this.client, DEFAULT_RETRY_CONFIG);
  }

  public async request(config: HttpRequest): Promise<HttpResponse> {
    try {
      const response = await this.client.request({
        data: config.data,
        headers: config.headers,
        method: config.method,
        url: config.url
      });
      return {
        data: response.data,
        status: response.status
      };
    } catch (error) {
      if (error?.response) {
        return {
          data: error.response.data,
          status: error.response.status
        };
      }
      if (error?.code) {
        return {
          data: { message: error.message },
          status: error.code
        };
      }
      return error;
    }
  }
}
