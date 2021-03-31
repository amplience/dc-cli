/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiClient } from '../services/ApiClient';

/**
 * @hidden
 */
export type ApiResourceConstructor<T extends ApiResource> = new (data?: any) => T;

/**
 * Base class for all Resources
 */
export class ApiResource {
  /**
   * @hidden
   */
  // tslint:disable-next-line
  protected _embedded: Map<string, any>;

  /**
   * @hidden
   */
  protected client: ApiClient;

  /**
   * Creates a new instance of the resource.
   * If data is provided it will be parsed as if it had
   * come from the remote api.
   * @param data
   */
  constructor(data?: any) {
    if (data) {
      this.parse(data);
    }
  }

  /**
   * Parses the data returned by the API into the model class
   * @hidden
   */
  public parse(data: any): void {
    Object.assign(this, data);
  }

  /**
   * Returns a copy of this resource's attributes excluding links and client references
   */
  public toJSON(): any {
    const result: any = Object.assign({}, this);
    delete result.client;
    delete result._links;
    delete result.related;
    return result;
  }

  /**
   * Set automatically by the HalClient when the resource is created.
   * If this is not set the resource will be unable to resolve related
   * resources and actions.
   *
   * @hidden
   */
  public setClient(client: ApiClient): void {
    this.client = client;
  }
}
