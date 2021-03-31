import { PublishInfoPut } from './PublishInfoPut';

export interface PublishActivitySummary {
  /**
   * Info on the last publish job, if present.
   */
  last?: PublishInfoPut;

  /**
   * Info on the last successful publish job, if present.
   */
  lastsuccess?: PublishInfoPut;
}
