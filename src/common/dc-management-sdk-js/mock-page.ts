import { HalResource, HalResourceConstructor, Page } from 'dc-management-sdk-js';

export default class MockPage<T extends HalResource> extends Page<T> {
  constructor(resourceType: HalResourceConstructor<T>, private readonly mockItems: T[]) {
    super('mock-page', resourceType, {});
  }

  getItems(): T[] {
    return this.mockItems;
  }
}
