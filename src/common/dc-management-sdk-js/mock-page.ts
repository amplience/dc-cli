import { HalResource, HalResourceConstructor, Page } from 'dc-management-sdk-js';

/**
 * @hidden
 */
export default class MockPage<T extends HalResource> extends Page<T> {
  constructor(resourceType: HalResourceConstructor<T>, private readonly mockItems: T[], data = {}) {
    super('mock-page', resourceType, data);
  }

  getItems(): T[] {
    return this.mockItems;
  }
}
