import { ApiResource } from '../api/model/ApiResource';

export interface AssetMetadataVariant {
  /**
   * The name of this metadata variant.
   */
  variantName: string;

  /**
   * The unique identifier of this metadata variant.
   */
  variantID: string;

  /**
   * Values contained in this metadata variant.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: { [K: string]: any };
}

export interface AssetMetadataItem {
  /**
   * Schema name for this type of metadata.
   */
  schema: string;

  /**
   * Schema ID for this type of metadata.
   */
  schemaID: string;

  /**
   * Variants of this metadata that are present on the parent asset.
   */
  variants: AssetMetadataVariant[];

  /**
   * Primary key identifying the parent asset.
   */
  PK: { id: string };
}

export class AssetMetadata extends ApiResource {
  /**
   * The metadata attached to the asset.
   */
  metadata: AssetMetadataItem[];

  /**
   * The ID of the related asset.
   */
  assetId: string;
}

export interface AssetRelationships {
  [key: string]: AssetMetadataItem;
}
