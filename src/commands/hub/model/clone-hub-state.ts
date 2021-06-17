import { Arguments } from 'yargs';
import { FileLog } from '../../../common/file-log';
import { CloneHubBuilderOptions } from '../../../interfaces/clone-hub-builder-options';
import { ConfigurationParameters } from '../../configure';

export interface CloneHubState {
  argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters>;
  from: Arguments<ConfigurationParameters>;
  to: Arguments<ConfigurationParameters>;
  path: string;

  logFile: FileLog;
  revertLog?: FileLog;
}
