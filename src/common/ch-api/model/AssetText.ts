import { ApiResource } from '../api/model/ApiResource';

/**
 * Retrieved text content for an asset, or a link to externally hosted content.
 */
export class AssetText extends ApiResource {
  /**
   * UUID identifier for the asset
   */
  id?: string;

  /**
   * Status of the data.
   * 'INTERNAL' (text data in the data field)
   * 'EXTERNAL' (URL in the data field pointing to the text file)
   * 'ERROR' (Error Message in the Info Field)
   */
  status?: 'INTERNAL' | 'EXTERNAL' | 'ERROR';

  /**
   * Data for the requested asset.
   */
  data?: string;

  /**
   * Information regarding the given status.
   */
  info?: string;
}

export class AssetTextList extends ApiResource {
  [index: number]: AssetText;
}
