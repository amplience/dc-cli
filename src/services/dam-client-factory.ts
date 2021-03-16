/* eslint-disable @typescript-eslint/camelcase */
import { DAM } from 'dam-management-sdk-js';
import { ConfigurationParameters } from '../commands/configure';

const damClientFactory = (config: ConfigurationParameters): DAM =>
  new DAM(
    {
      client_id: config.clientId,
      client_secret: config.clientSecret
    },
    {
      apiUrl: process.env.DAM_API_URL,
      authUrl: process.env.AUTH_URL
    }
  );

export default damClientFactory;
