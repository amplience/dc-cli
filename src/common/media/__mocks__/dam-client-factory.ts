/* eslint-disable @typescript-eslint/no-explicit-any */
import { DAM } from 'dam-management-sdk-js';
import { ConfigurationParameters } from '../../../commands/configure';
import { MockDAM } from '../mock-dam';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const damClientFactory = (_: ConfigurationParameters): DAM => (new MockDAM() as any) as DAM;

export default damClientFactory;
