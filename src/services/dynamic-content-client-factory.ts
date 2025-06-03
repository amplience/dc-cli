import { DynamicContent } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../commands/configure';
import { DCHttpClient } from '../common/dc-management-sdk-js/http-client/dc-http-client';

const dynamicContentClientFactory = (config: ConfigurationParameters): DynamicContent =>
  new DynamicContent(
    {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      patToken: config.patToken
    },
    {
      apiUrl: process.env.API_URL,
      authUrl: process.env.AUTH_URL
    },
    new DCHttpClient({ timeout: 25000 })
  );

export default dynamicContentClientFactory;
