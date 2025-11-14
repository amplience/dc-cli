import { Hub, Webhook } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';

export const mockValues = ({
  getHubError = false,
  getWebhookError = false,
  listWebhookError = false
}): {
  mockGet: () => void;
  getHubMock: () => void;
  mockWebhooksList: () => void;
  mockWebhookUpdate: () => void;
  mockWebhookCreate: () => void;
} => {
  const mockGet = jest.fn();
  const getHubMock = jest.fn();
  const mockWebhooksList = jest.fn();
  const mockWebhookUpdate = jest.fn();
  const mockWebhookCreate = jest.fn();

  (dynamicContentClientFactory as jest.Mock).mockReturnValue({
    hubs: {
      get: getHubMock
    },
    webhooks: {
      get: mockGet
    }
  });

  const hub = new Hub({
    name: '1',
    id: '1',
    _links: {
      webhooks: {
        href: 'https://api.amplience.net/v2/content/webhooks',
        templated: true
      }
    }
  });

  getHubMock.mockResolvedValue(hub);

  hub.related.webhooks.list = mockWebhooksList;
  hub.related.webhooks.create = mockWebhookCreate;

  const webhooks = [
    new Webhook({
      id: '1',
      label: 'WH1',
      events: ['dynamic-content.content-item.updated'],
      active: true,
      handlers: ['https://test.this/webhook'],
      secret: 'xxxx',
      method: 'POST'
    }),
    new Webhook({
      id: '2',
      label: 'WH2',
      events: ['dynamic-content.content-item.updated'],
      active: true,
      handlers: ['https://test.this/webhook'],
      secret: 'xxxx',
      method: 'POST'
    })
  ];

  mockWebhooksList.mockResolvedValue(new MockPage(Webhook, webhooks));

  const webhook = new Webhook({
    id: '1',
    label: 'WH1',
    events: ['dynamic-content.content-item.updated'],
    active: true,
    handlers: ['https://test.this/webhook'],
    secret: 'xxxx',
    method: 'POST'
  });

  mockGet.mockResolvedValue(webhook);

  webhook.related.update = mockWebhookUpdate;

  if (getHubError) {
    getHubMock.mockRejectedValue(new Error('Error'));
  }

  if (getWebhookError) {
    mockGet.mockRejectedValue(new Error('Error'));
  }

  if (listWebhookError) {
    mockWebhooksList.mockRejectedValue(new Error('Error'));
  }

  return {
    mockGet,
    getHubMock,
    mockWebhooksList,
    mockWebhookUpdate,
    mockWebhookCreate
  };
};
