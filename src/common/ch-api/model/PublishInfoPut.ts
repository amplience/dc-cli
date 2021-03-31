export interface PublishInfoPut {
  /**
   * The publish job ID
   */
  jobID: string;

  /**
   * The revision number of the published asset.
   */
  revisionNumber: number;

  /**
   * The timestamp of when the publish job status was last updated.
   */
  timestamp: number;

  /**
   * The status of this publish job.
   */
  status: string;
}
