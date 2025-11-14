import { Hub } from 'dc-management-sdk-js';

export const getWebhooksByIds = async (hub: Hub, ids: string[]) => {
  const webhooks = [];

  for (const id of ids) {
    try {
      webhooks.push(await hub.related.webhooks.get(id));
    } catch (e) {
      // silently fail missing webhooks
    }
  }

  return webhooks;
};
