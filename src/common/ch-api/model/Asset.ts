/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiResource } from '../api/model/ApiResource';
import { PublishActivitySummary } from './PublishActivitySummary';
import { Page } from './Page';
import { ResourceList } from './ResourceList';
import { AssetRelationships } from './AssetMetadata';
import { WorkflowSummary } from './WorkflowSummary';

export class Asset extends ApiResource {
  /**
   * UUID identifier for this asset.
   */
  id: string;

  /**
   * The original filename of the source file for this asset.
   */
  srcName?: string;

  /**
   * The latest revision number for this asset. Increments with each update.
   */
  revisionNumber?: number;

  /**
   * UUID of the bucket this asset is contained within.
   */
  bucketID: string;

  /**
   * Friendly label for the asset.
   */
  label?: string;

  /**
   * MIME type for this asset.
   */
  mimeType: string;

  /**
   * High level type for this asset, e.g. 'image'.
   */
  type?: string;

  /**
   * Locale name for this asset.
   */
  locale: string;

  /**
   * User UUID of the creator of this asset.
   */
  userID?: string;

  /**
   * Thumbnail file for this asset, if applicable.
   */
  thumbFile?: string;

  /**
   * The id of the containing folder for this asset.
   * Value is an empty GUID if the asset is not contained in a folder.
   */
  folderID?: string;

  /**
   * UUID of the file backing this asset.
   */
  file?: string;

  /**
   * Created timestamp for this asset.
   */
  createdDate: number;

  /**
   * Filesize of the asset in bytes. Only available when 'file' is selected.
   */
  size: number;

  /**
   * Unique name for the asset. This is unique across the account so it can be flattenned for the public URL.
   */
  name?: string;

  /**
   * Sub type for this asset.
   */
  subType?: any;

  /**
   * Thumbnail URL for this asset, if applicable.
   */
  thumbUrl?: string;

  /**
   * Asset publish information. Only available when 'publish' is selected.
   */
  publish?: PublishActivitySummary;

  /**
   * Asset unpublish information. Only available when 'publish' is selected.
   */
  unpublish?: PublishActivitySummary;

  /**
   * Workflow summary for this asset. Only available when 'workflow' is selected.
   */
  workflow?: WorkflowSummary;

  /**
   * Tags for this asset. Only available when 'tags' is selected.
   */
  tags?: string[];

  /**
   * Metadata for this asset. Only available when 'meta:<schema>' is selected.
   */
  relationships?: AssetRelationships;

  /**
   * The current publish status of this asset.
   */
  publishStatus?: 'NOT_PUBLISHED' | 'PUBLISH_IN_PROGRESS' | 'UNPUBLISH_IN_PROGRESS' | 'PUBLISHED';

  /**
   * Last modified timestamp for this asset.
   */
  timestamp?: string;

  /**
   * The status of this asset.
   */
  status?: 'deleted' | 'active';

  /**
   * UUID of the locale of the asset
   */
  localeID?: string;

  /**
   * Locale group that the asset belongs to.
   */
  localeGroup?: string;

  /**
   * Resources and actions related to a Content Item
   */
  public readonly related = {};
}

/**
 * @hidden
 */
export class AssetsList extends ResourceList<Asset> {
  constructor(data?: any) {
    super(Asset, data);
  }
}

/**
 * @hidden
 */
export class AssetsPage extends Page<Asset> {
  constructor(data?: any) {
    super(Asset, data);
  }
}
