import { PublishActivitySummary } from './PublishActivitySummary';
import { TagsPut } from './TagsPut';
import { WorkflowSummary } from './WorkflowSummary';

export interface AssetPut {
  /**
   * Path to the input file. E.g. http://url... s3://.... multipart://...
   */
  src?: string;

  /**
   * UUID identifier for the asset
   */
  id?: string;

  /**
   * ['image' or 'video' or 'set' or 'spin' or 'document' or 'other']: Sets the type of media to create
   */
  type?: string;

  /**
   * Unique name for the asset, this is unique across the account so we can flatten the it on the public URL
   */
  name?: string;

  /**
   * Friendly label for the asset, this is what a customer will see. If not specified this will default to srcName.
   */
  label?: string;

  /**
   * Name of the asset to use as a thumbnail. This should be a file ID not an asset ID
   */
  thumbFile?: string;

  /**
   * Original filename
   */
  srcName?: string;

  /**
   * ['active' or 'deleted' or 'expired']: Lifecycle Status, defaults to Active
   */
  status?: string;

  /**
   * UUID of the Folder this asset is contained within. Empty uuid means it is not in a specific folder
   */
  folderID?: string;

  /**
   * Add or Remove Tags when loading asset (Remove tags is for when you update an asset, no point when creating one)
   */
  tags?: TagsPut;

  /**
   * The publish status for the asset. One of: NOT_PUBLISHED, PUBLISH_IN_PROGRESS, UNPUBLISH_IN_PROGRESS, PUBLISHED
   */
  publishStatus?: 'NOT_PUBLISHED' | 'PUBLISH_IN_PROGRESS' | 'UNPUBLISH_IN_PROGRESS' | 'PUBLISHED';

  /**
   * Information regarding publish activities.
   */
  publish?: PublishActivitySummary;

  /**
   * Information regarding unpublish activities.
   */
  unpublish?: PublishActivitySummary;

  /**
   * Information regarding assets workflow.
   */
  workflow?: WorkflowSummary;

  /**
   * If Asset type is a set (media\spin\2d...) then this will be the list of assetIds.
   */
  contents?: string[];

  /**
   * UUID of the locale of the asset.
   */
  localeID?: string;

  /**
   * Name of the localeGroup the asset belongs to. Defaults to asset name.
   */
  localeGroup?: string;
}
