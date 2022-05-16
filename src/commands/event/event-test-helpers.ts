import { Hub, Event, Edition, EditionSlot, Snapshot, ContentItem } from 'dc-management-sdk-js';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';

export const mockValues = ({
  status = 'DRAFT',
  deleteResource = false,
  mixedEditions = false,
  getHubError = false,
  getEventError = false,
  listEventError = false,
  listEditionError = false,
  getSnapshotError = false
}): {
  mockGet: () => void;
  mockEditionsList: () => void;
  mockEditionGet: () => void;
  mockEditionUpdate: () => void;
  getHubMock: () => void;
  mockEventsList: () => void;
  mockEventUpdate: () => void;
  mockEventCreate: () => void;
  mockSlotsList: () => void;
  mockSlotContent: () => void;
  mockSnapshotGet: () => void;
  mockSnapshotItem: () => void;
  mockSnapshotCreate: () => void;
  mockEditionUnschedule: () => void;
  mockEdition: Edition;
} => {
  const mockGet = jest.fn();
  const getHubMock = jest.fn();
  const mockEditionsList = jest.fn();
  const mockEditionGet = jest.fn();
  const mockEditionUpdate = jest.fn();
  const mockEventsList = jest.fn();
  const mockEventUpdate = jest.fn();
  const mockEventCreate = jest.fn();
  const mockSlotsList = jest.fn();
  const mockSlotContent = jest.fn();
  const mockSnapshotGet = jest.fn();
  const mockSnapshotItem = jest.fn();
  const mockSnapshotCreate = jest.fn();
  const mockEditionUnschedule = jest.fn();

  (dynamicContentClientFactory as jest.Mock).mockReturnValue({
    hubs: {
      get: getHubMock
    },
    events: {
      get: mockGet
    },
    editions: {
      get: mockEditionGet
    },
    snapshots: {
      get: mockSnapshotGet
    }
  });

  const hub = new Hub({
    name: '1',
    id: '1',
    _links: {
      events: {
        href: 'https://api.amplience.net/v2/content/events',
        templated: true
      }
    }
  });

  getHubMock.mockResolvedValue(hub);

  hub.related.events.list = mockEventsList;
  hub.related.events.create = mockEventCreate;
  hub.related.snapshots.create = mockSnapshotCreate;

  const events = [
    new Event({
      id: 'test1',
      name: 'test1',
      start: '2021-05-05T12:00:00.000Z',
      end: '2021-05-06T12:00:00.000Z',
      client: {
        fetchLinkedResource: mockEditionsList
      },
      _links: {
        editions: {
          href: 'https://api.amplience.net/v2/content/events/1/editions{?projection,page,size,sort}',
          templated: true
        },
        delete: {
          href: 'https://api.amplience.net/v2/content/events/1'
        },
        archive: {
          href: 'https://api.amplience.net/v2/content/events/1/archive'
        }
      },
      related: {
        editions: {
          list: mockEditionsList
        }
      }
    }),
    new Event({
      id: 'test2',
      name: 'test2',
      start: '2021-05-07T12:00:00.000Z',
      end: '2021-05-08T12:00:00.000Z',
      client: {
        fetchLinkedResource: mockEditionsList
      },
      _links: {
        editions: {
          href: 'https://api.amplience.net/v2/content/events/2/editions{?projection,page,size,sort}',
          templated: true
        },
        delete: {
          href: 'https://api.amplience.net/v2/content/events/2'
        },
        archive: {
          href: 'https://api.amplience.net/v2/content/events/2/archive'
        }
      },
      related: {
        editions: {
          list: mockEditionsList
        }
      }
    })
  ];

  mockEventsList.mockResolvedValue(new MockPage(Event, events));

  const event = new Event({
    name: 'test1',
    id: '1',
    start: '2021-05-05T12:00:00.000Z',
    end: '2021-05-06T12:00:00.000Z',
    client: {
      fetchLinkedResource: mockEditionsList
    },
    _links: {
      editions: {
        href: 'https://api.amplience.net/v2/content/events/1/editions{?projection,page,size,sort}',
        templated: true
      },
      delete: !deleteResource && {
        href: 'https://api.amplience.net/v2/content/events/1'
      },
      archive: {
        href: 'https://api.amplience.net/v2/content/events/1/archive'
      }
    },
    related: {
      editions: {
        list: mockEditionsList
      }
    }
  });

  mockGet.mockResolvedValue(event);

  event.related.update = mockEventUpdate;

  const editions = [
    new Edition({
      name: 'ed1',
      id: 'ed1',
      publishingStatus: status,
      client: {
        fetchLinkedResource: mockSlotsList
      },
      _links: {
        'list-slots': {
          href: 'https://api.amplience.net/v2/content/editions/ed1/slots{?includedSlots}',
          templated: true
        },
        archive: {
          href: 'https://api.amplience.net/v2/content/editions/ed1/archive'
        },
        delete: {
          href: 'https://api.amplience.net/v2/content/editions/ed1'
        },
        schedule: {
          href: 'https://api.amplience.net/v2/content/editions/ed1/schedule'
        }
      }
    })
  ];

  const slots = [
    new EditionSlot({
      id: 'slot1',
      eventId: 'test1',
      editionId: 'ed1',
      createdDate: '2021-05-06T09:52:27.065Z',
      lastModifiedDate: '2021-05-06T09:52:27.065Z',
      content: {
        body: {
          _meta: { schema: 'http://schema.com/test.json', name: 'example-slot-test' },
          link: [
            {
              _meta: {
                schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link',
                rootContentItemId: 'content-item-1',
                locked: 'true'
              },
              contentType: 'http://schema.com/test.json',
              id: 'snapshot1'
            }
          ]
        }
      },
      status: 'VALID',
      slotStatus: 'ACTIVE',
      contentTypeId: 'testType',
      slotId: 'testSlotId',
      slotLabel: 'example-slot-test',
      conflicts: false,
      locale: null,
      empty: false,
      _links: {
        self: {
          href: 'https://api.amplience.net/v2/content/editions/ed1/slots/slot1'
        },
        'edition-slot': {
          href: 'https://api.amplience.net/v2/content/editions/ed1/slots/slot1'
        },
        edition: {
          href: 'https://api.amplience.net/v2/content/editions/ed1'
        },
        slot: {
          href: 'https://api.amplience.net/v2/content/content-items/testSlotId{?projection}',
          templated: true
        },
        content: {
          href: 'https://api.amplience.net/v2/content/editions/ed1/slots/slot1/content'
        },
        'safe-update-content': {
          href:
            'https://api.amplience.net/v2/content/editions/ed1/slots/slot1/content{?lastModifiedDate,page,size,sort}',
          templated: true
        }
      }
    })
  ];

  if (mixedEditions) {
    editions.push(
      new Edition({
        name: 'ed2',
        id: 'ed2',
        publishingStatus: 'PUBLISHED',
        client: {
          fetchLinkedResource: mockEventsList
        },
        _links: {
          archive: {
            href: 'https://api.amplience.net/v2/content/editions/ed2/archive'
          },
          delete: {
            href: 'https://api.amplience.net/v2/content/editions/ed2'
          },
          schedule: {
            href: 'https://api.amplience.net/v2/content/editions/ed2/schedule'
          }
        }
      })
    );
  }
  mockEditionsList.mockResolvedValue(new MockPage(Edition, editions));

  mockSlotsList.mockResolvedValue(new MockPage(EditionSlot, slots));

  const snapshot = new Snapshot({
    id: 'snapshot-1',
    comment: '',
    createdDate: '2018-04-04T16:00:06.945Z',
    createdBy: 'user',
    createdFrom: 'content-item',
    type: 'USER',
    meta: [],
    taggedEditions: [
      {
        editionId: 'ed1',
        createdDate: '2018-04-04T16:00:07Z',
        createdBy: 'user'
      }
    ],
    locale: null,
    rootContentItem: {
      label: 'Content Item',
      contentTypeUri: 'http://schema.com/test.json',
      id: 'content-item-1'
    },
    rootContentItems: [
      {
        label: 'Content Item',
        contentTypeUri: 'http://schema.com/test.json',
        id: 'content-item-1'
      }
    ]
  });

  snapshot.related.snapshotContentItem = mockSnapshotItem;

  mockSnapshotGet.mockResolvedValue(snapshot);

  mockSnapshotItem.mockResolvedValue(
    new ContentItem({
      id: 'content-item-1',
      contentRepositoryId: 'repo1',
      body: {
        _meta: {
          name: 'test',
          schema: 'http://schema.com/test.json'
        },
        simpleContent: 'test'
      },
      version: 9,
      label: 'Content Item',
      status: 'ACTIVE'
    })
  );

  editions[0].related.update = mockEditionUpdate;
  editions[0].related.unschedule = mockEditionUnschedule;
  slots[0].related.content = mockSlotContent;
  mockEditionGet.mockResolvedValue(editions[0]);

  if (getHubError) {
    getHubMock.mockRejectedValue(new Error('Error'));
  }

  if (getEventError) {
    mockGet.mockRejectedValue(new Error('Error'));
  }

  if (listEventError) {
    mockEventsList.mockRejectedValue(new Error('Error'));
  }

  if (listEditionError) {
    mockEditionsList.mockRejectedValue(new Error('Error'));
  }

  if (getSnapshotError) {
    mockSnapshotGet.mockRejectedValue(new Error('Error'));
  }

  return {
    mockGet,
    getHubMock,
    mockEditionsList,
    mockEditionGet,
    mockEditionUpdate,
    mockEditionUnschedule,
    mockEventsList,
    mockEventUpdate,
    mockEventCreate,
    mockSlotsList,
    mockSlotContent,
    mockSnapshotGet,
    mockSnapshotItem,
    mockSnapshotCreate,
    mockEdition: editions[0]
  };
};
