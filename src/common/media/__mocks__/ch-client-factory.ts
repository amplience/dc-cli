/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContentHub } from '../../ch-api/ContentHub';
import { ConfigurationParameters } from '../../../commands/configure';
import { MockContentHub } from '../mock-ch';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const chClientFactory = (_: ConfigurationParameters): ContentHub => (new MockContentHub() as any) as ContentHub;

export default chClientFactory;
