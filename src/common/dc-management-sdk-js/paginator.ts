import { HalResource, Page, Pageable, Sortable } from 'dc-management-sdk-js';
import { ResourceStatus } from './resource-status';
import { PaginatorOptions } from './paginator-options';

export const DEFAULT_SIZE = 100;

const paginator = async <T extends HalResource>(
  pagableFn: (options?: Pageable & Sortable & ResourceStatus) => Promise<Page<T>>,
  options: Pageable & Sortable & ResourceStatus = {},
  paginatorOptions: PaginatorOptions = {}
): Promise<T[]> => {
  const currentPage = await pagableFn({ ...options, size: DEFAULT_SIZE });
  if (paginatorOptions?.onPage) {
    paginatorOptions.onPage(currentPage);
  }
  if (
    currentPage.page &&
    currentPage.page.number !== undefined &&
    currentPage.page.totalPages !== undefined &&
    currentPage.page.number + 1 < currentPage.page.totalPages
  ) {
    return [
      ...currentPage.getItems(),
      ...(await paginator(pagableFn, { ...options, page: currentPage.page.number + 1 }, { ...paginatorOptions }))
    ];
  }
  return currentPage.getItems();
};

export default paginator;
