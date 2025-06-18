import { HalResource, Page } from 'dc-management-sdk-js';

export interface PaginatorOptions {
  onPage?: <T extends HalResource>(page: Page<T>) => void;
}
