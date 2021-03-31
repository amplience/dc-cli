/**
 * Parameters for asset requests
 */
export interface AssetRequest {
  /**
   * Comma separated list to select subsections to include, e.g. tags,meta:{schema},meta:*
   */
  select?: string;

  /**
   * Comma seperated list of metadata variants to include in the result.
   */
  variants?: string;
}
