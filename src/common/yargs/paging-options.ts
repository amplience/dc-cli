import { CommandOptions } from '../../interfaces/command-options.interface';
import { Pageable, Sortable } from 'dc-management-sdk-js';

export const PagingOptions: CommandOptions = {
  page: {
    type: 'number',
    description: 'page number to retrieve'
  },
  size: {
    type: 'number',
    description: 'number of items per page'
  },
  sort: {
    type: 'string',
    description: 'how to order the list e.g createdDate,asc'
  }
};

export interface PagingParameters {
  page?: number;
  size?: number;
  sort?: string;
}

export const extractPageableSortable = (pagingParameters: PagingParameters): Pageable & Sortable => {
  const { page, sort, size } = pagingParameters;
  return {
    ...(page ? { page } : {}),
    ...(sort ? { sort } : {}),
    ...(size ? { size } : {})
  } as Pageable & Sortable;
};
