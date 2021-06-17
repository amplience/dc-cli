import { AssetRequest } from './AssetRequest';
import { Pageable } from './Pageable';

/**
 * Parameters for asset list requests
 */
export interface AssetListRequest extends Pageable, AssetRequest {
  /**
   * Search terms. The search fields are Label, Name, and srcName.
   */
  q?: string;

  /**
   * A query to use to restrict the set of assets that will be searched over and returned
   */
  filter?: string;

  /**
   * Comma-separated list of fields to return for each asset.
   */
  c?: string;

  /**
   * The id of a folder to search in.
   */
  f?: string;

  /**
   * The id of a bucket to search in.
   */
  bucket?: string;

  /**
   * Comma seperated list locales in order of preference from left to right.
   */
  preferredLocales?: string;

  /**
   * The maximum length of the text snippet. (default is 200 characters)
   */
  snippetSize?: string;

  /**
   * Highlight parameters.
   */
  highlight?: {
    /**
     * Field to highlight on (All Fields available as default (*))
     */
    fl?: string;

    /**
     * Pre tag to wrap highlighted text (default is )
     */
    pre?: string;

    /**
     * Post tag to wrap highlighted text (default is )
     */
    post?: string;

    /**
     * The maximum number of highlighted snippets to generate per field. (default is 1)
     */
    max?: number;
  };

  /**
   * Locale group parameters.
   */
  localeGroups?: {
    /**
     * Whether or not to retreat assets in a locale group as a single asset or as individual assets. (default is false)
     */
    collapse?: boolean;

    /**
     * Order of preference for the locale of the asset which will be returned for each group of assets
     */
    preferredLocales?: string;

    /**
     * The maximum number of siblings to return for a single asset. (default is 20)
     */
    limit?: number;
  };

  /**
   * field(s) on which the sorting of the results is based off ( default is on the update field)
   */
  sort?: string;
}
