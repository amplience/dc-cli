/* eslint-disable @typescript-eslint/camelcase */
import { ContentHub } from '../common/ch-api/ContentHub';
import { ConfigurationParameters } from '../commands/configure';

const chClientFactory = (config: ConfigurationParameters): ContentHub =>
  new ContentHub(
    {
      client_id: config.clientId,
      client_secret: config.clientSecret
    },
    {
      apiUrl: process.env.DAM_API_URL,
      authUrl: process.env.AUTH_URL
    }
  );

export default chClientFactory;
