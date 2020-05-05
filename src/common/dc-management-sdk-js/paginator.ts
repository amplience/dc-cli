import { HalResource, Page, Pageable, Sortable } from 'dc-management-sdk-js';

export const DEFAULT_SIZE = 100;

interface StatusQuery {
  status?: 'ARCHIVED' | 'ACTIVE' | 'DELETED';
}

const paginator = async <T extends HalResource>(
  pagableFn: (options?: Pageable & Sortable & StatusQuery) => Promise<Page<T>>,
  options: Pageable & Sortable & StatusQuery = {}
): Promise<T[]> => {
  const currentPage = await pagableFn({ ...options, size: DEFAULT_SIZE });
  if (
    currentPage.page &&
    currentPage.page.number !== undefined &&
    currentPage.page.totalPages !== undefined &&
    currentPage.page.number + 1 < currentPage.page.totalPages
  ) {
    return [
      ...currentPage.getItems(),
      ...(await paginator(pagableFn, { ...options, page: currentPage.page.number + 1 }))
    ];
  }
  return currentPage.getItems();
};

export default paginator;
