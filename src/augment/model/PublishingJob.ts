import { HalResource } from 'dc-management-sdk-js';
import { PublishingJobState } from './PublishingJobState';

export class PublishingJob extends HalResource {
  public id?: string;

  public comment?: string;

  public createdBy?: string;

  public createdDate?: string;

  public state?: PublishingJobState;

  public publishErrotStatus?: string;
}
