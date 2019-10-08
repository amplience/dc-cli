import { CommandOptions } from '../../interfaces/command-options.interface';
import { Pageable, Sortable } from 'dc-management-sdk-js';

export const SortingOptions: CommandOptions = {
  sort: {
    type: 'string',
    description: 'how to order the list e.g "<property>,<asc|desc>..."'
  }
};

export interface PagingParameters {
  sort?: string;
}

export const extractSortable = (pagingParameters: PagingParameters): Sortable => {
  const { sort } = pagingParameters;
  return {
    ...(sort ? { sort } : {})
  } as Pageable & Sortable;
};
