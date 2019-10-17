import { ValidationLevel } from 'dc-management-sdk-js';

export interface ImportBuilderOptions {
  dir?: string;
  remote?: string;
  validationLevel: ValidationLevel;
}
