export interface TagsPut {
  /**
   * Tags to remove from an asset.
   */
  remove?: string[];

  /**
   * Tags to add to an asset.
   */
  add?: string[];
}
