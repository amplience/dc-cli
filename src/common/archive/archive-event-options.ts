<<<<<<< HEAD
import { FileLog } from '../file-log';

=======
>>>>>>> fix(content-item): fix event command
export default interface ArchiveOptions {
  id?: string | string[];

  name?: string | string[];

<<<<<<< HEAD
  logFile: FileLog;
=======
  logFile?: string;
>>>>>>> fix(content-item): fix event command
  force?: boolean;
  silent?: boolean;
  ignoreError?: boolean;
}
