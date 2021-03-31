/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiResource, ApiResourceConstructor } from '../api/model/ApiResource';

export class ResourceList<T extends ApiResource> extends ApiResource {
  private resourceType: ApiResourceConstructor<T>;
  private items: T[];

  private data: any[];
  private count: number;

  constructor(resourceType: ApiResourceConstructor<T>, data?: any) {
    super(data);
    this.resourceType = resourceType;
  }

  public getItems(): T[] {
    if (!this.items) {
      this.items = this.data.map(x => this.client.parse(x, this.resourceType));
    }
    return this.items;
  }

  public toJSON(): any {
    const result = super.toJSON();
    result.data = this.getItems().map(item => item.toJSON());
    delete result.resourceType;
    delete result.items;
    return result;
  }
}
