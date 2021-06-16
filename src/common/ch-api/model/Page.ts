import { ApiResource } from '../api/model/ApiResource';
import { ResourceList } from './ResourceList';

export class Page<T extends ApiResource> extends ResourceList<T> {
  /**
   * The total number of resources found.
   */
  numFound: number;

  /**
   * The starting index of this page.
   */
  start: number;

  /**
   * The number of resources displayed on each page.
   */
  pageSize: number;
}
