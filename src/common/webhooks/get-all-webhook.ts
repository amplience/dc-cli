import { Hub } from 'dc-management-sdk-js';
import paginator from '../dc-management-sdk-js/paginator';

export const getAllWebhooks = async (hub: Hub) => {
  return await paginator(hub.related.webhooks.list);
};
