/**
 * Parameters for paginated requests
 */
export interface Pageable {
  /**
   * Position of the first asset to return (1 based)
   */
  s?: number;

  /**
   * Maximum resources to return
   */
  n?: number;
}
