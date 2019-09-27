/* eslint-disable @typescript-eslint/camelcase */
import { DynamicContent } from 'dc-management-sdk-js';
import { GlobalConfigurationParameters } from '../configuration/command-line-parser.service';

const dynamicContentClientFactory = (config: GlobalConfigurationParameters): DynamicContent =>
  new DynamicContent(
    {
      client_id: config.key,
      client_secret: config.secret
    },
    {
      apiUrl: process.env.API_URL,
      authUrl: process.env.AUTH_URL
    }
  );

export default dynamicContentClientFactory;
