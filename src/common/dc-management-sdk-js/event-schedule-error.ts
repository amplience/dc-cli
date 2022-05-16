import { HalResource } from 'dc-management-sdk-js';

export interface EditionScheduleOverlap {
  editionId: string;
  name: string;
  start: string;
}

export interface EditionScheduleError {
  level: 'WARNING' | 'ERROR';
  code: string;
  message: string;
  overlaps?: EditionScheduleOverlap[];
}

export class EditionScheduleStatus extends HalResource {
  public errors?: EditionScheduleError[];
}
