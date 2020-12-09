import { builder, command, handler, LOG_FILENAME, processItems, getEvents } from './archive';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Event, Edition, Hub } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import readline from 'readline';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { promisify } from 'util';
import { exists, readFile, unlink } from 'fs';

jest.mock('readline');

jest.mock('../../services/dynamic-content-client-factory');

describe('event archive command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });
  const yargArgs = {
    $0: 'test',
    _: ['test'],
    json: true,
    silent: true
  };
  const config = {
    clientId: 'client-id',
    clientSecret: 'client-id',
    hubId: 'hub-id'
  };

  it('should command should defined', function() {
    expect(command).toEqual('archive [id]');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        type: 'string',
        describe: 'The ID of an Event to be archived. If id is not provided, this command will not archive something.'
      });

      expect(spyOption).toHaveBeenCalledWith('name', {
        type: 'string',
        describe:
          'The name of an Event to be archived.\nA regex can be provided to select multiple items with similar or matching names (eg /.header/).\nA single --name option may be given to match a single event pattern.\nMultiple --name options may be given to match multiple events patterns at the same time, or even multiple regex.'
      });

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before archiving the found content.'
      });

      expect(spyOption).toHaveBeenCalledWith('s', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, no log file will be produced.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.'
      });
    });
  });

  const mockValues = ({
    archiveError = false,
    status = 'DRAFT',
    deleteResource = false,
    mixedEditions = false,
    getHubError = false,
    getEventError = false
  }): {
    mockGet: () => void;
    mockEditionsList: () => void;
    deleteMock: () => void;
    archiveMock: () => void;
    getHubMock: () => void;
    mockEventsList: () => void;
  } => {
    const mockGet = jest.fn();
    const mockEditionsList = jest.fn();
    const deleteMock = jest.fn();
    const archiveMock = jest.fn();
    const getHubMock = jest.fn();
    const mockEventsList = jest.fn();

    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      client: {
        deleteLinkedResource: deleteMock,
        performActionThatReturnsResource: archiveMock
      },
      hubs: {
        get: getHubMock
      },
      events: {
        get: mockGet,
        related: {
          delete: deleteMock,
          archive: archiveMock
        }
      }
    });

    getHubMock.mockResolvedValue(
      new Hub({
        name: '1',
        id: '1',
        client: {
          fetchLinkedResource: mockEventsList,
          performActionThatReturnsResource: archiveMock,
          deleteLinkedResource: deleteMock
        },
        _links: {
          events: {
            href: 'https://api.amplience.net/v2/content/events',
            templated: true
          }
        },
        related: {
          events: {
            list: mockEventsList
          }
        }
      })
    );

    mockEventsList.mockResolvedValue(
      new MockPage(Event, [
        new Event({
          id: 'test1',
          name: 'test1',
          client: {
            fetchLinkedResource: mockEditionsList,
            performActionThatReturnsResource: archiveMock,
            deleteLinkedResource: deleteMock
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
            delete: deleteMock,
            archive: archiveMock,
            editions: {
              list: mockEditionsList
            }
          }
        }),
        new Event({
          id: 'test2',
          name: 'test2',
          client: {
            fetchLinkedResource: mockEditionsList,
            performActionThatReturnsResource: archiveMock,
            deleteLinkedResource: deleteMock
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
            delete: deleteMock,
            archive: archiveMock,
            editions: {
              list: mockEditionsList
            }
          }
        })
      ])
    );

    mockGet.mockResolvedValue(
      new Event({
        name: 'test1',
        id: '1',
        client: {
          fetchLinkedResource: mockEditionsList,
          performActionThatReturnsResource: archiveMock,
          deleteLinkedResource: deleteMock
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
          delete: deleteMock,
          archive: archiveMock,
          editions: {
            list: mockEditionsList
          }
        }
      })
    );

    const editions = [
      new Edition({
        name: 'ed1',
        id: 'ed1',
        publishingStatus: status,
        client: {
          fetchLinkedResource: mockEditionsList,
          performActionThatReturnsResource: archiveMock,
          deleteLinkedResource: deleteMock
        },
        _links: {
          archive: {
            href: 'https://api.amplience.net/v2/content/editions/ed1/archive'
          },
          delete: {
            href: 'https://api.amplience.net/v2/content/editions/ed1'
          },
          schedule: {
            href: 'https://api.amplience.net/v2/content/editions/ed1/schedule'
          }
        },
        related: {
          delete: deleteMock,
          archive: archiveMock
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
            fetchLinkedResource: mockEventsList,
            performActionThatReturnsResource: archiveMock,
            deleteLinkedResource: deleteMock
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

    if (archiveError) {
      archiveMock.mockRejectedValue(new Error('Error'));
      deleteMock.mockRejectedValue(new Error('Error'));
    }

    if (getHubError) {
      getHubMock.mockRejectedValue(new Error('Error'));
    }

    if (getEventError) {
      mockGet.mockRejectedValue(new Error('Error'));
    }

    return {
      mockGet,
      mockEditionsList,
      archiveMock,
      deleteMock,
      mockEventsList,
      getHubMock
    };
  };

  describe('handler tests', function() {
    it('should delete event with draft edition', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockEditionsList, deleteMock } = mockValues({});

      const argv = {
        ...yargArgs,
        ...config,
        id: '1'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalled();
      expect(deleteMock).toBeCalledTimes(1);
    });

    it('should archive event with published', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockEditionsList, archiveMock } = mockValues({ status: 'PUBLISHED' });

      const argv = {
        ...yargArgs,
        ...config,
        id: '1'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalled();
      expect(archiveMock).toBeCalledTimes(2);
    });

    it('should delete event with scheduled edition', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockEditionsList, deleteMock } = mockValues({ status: 'SCHEDULED' });

      const argv = {
        ...yargArgs,
        ...config,
        id: '1'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalled();
      expect(deleteMock).toBeCalledTimes(2);
    });

    it("shouldn't archive event, no id", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockEditionsList, deleteMock, archiveMock } = mockValues({ status: 'SCHEDULED' });

      const argv = {
        ...yargArgs,
        ...config
      };
      await handler(argv);

      expect(mockGet).not.toHaveBeenCalled();
      expect(mockEditionsList).not.toHaveBeenCalled();
      expect(deleteMock).not.toHaveBeenCalled();
      expect(archiveMock).not.toHaveBeenCalled();
    });

    it('should archive event by name', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { getHubMock, mockEventsList, mockEditionsList, deleteMock, mockGet } = mockValues({});

      const argv = {
        ...yargArgs,
        ...config,
        name: '/test/'
      };
      await handler(argv);

      expect(getHubMock).toHaveBeenCalled();
      expect(mockEventsList).toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
      expect(deleteMock).toBeCalledTimes(2);
    });

    it("shouldn't archive event by name", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { getHubMock, mockEventsList, mockEditionsList, deleteMock, mockGet } = mockValues({});

      const argv = {
        ...yargArgs,
        ...config,
        name: '/abc/'
      };
      await handler(argv);

      expect(getHubMock).toHaveBeenCalled();
      expect(mockEventsList).toHaveBeenCalled();
      expect(mockEditionsList).not.toHaveBeenCalled();
      expect(mockGet).not.toHaveBeenCalled();
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it('should log error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockEditionsList, deleteMock, mockGet } = mockValues({ archiveError: true, status: 'SHCEDULED' });

      const argv = {
        ...yargArgs,
        ...config,
        id: '1'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalled();
      expect(deleteMock).toBeCalledTimes(0);
    });

    it('should log error, no resource', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockEditionsList, deleteMock, mockGet } = mockValues({ status: 'DRAFT', deleteResource: true });

      const argv = {
        ...yargArgs,
        ...config,
        id: '1'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalled();
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it('should archive event and delete 1 edition', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockEditionsList, deleteMock, archiveMock, mockGet } = mockValues({
        status: 'DRAFT',
        mixedEditions: true
      });

      const argv = {
        ...yargArgs,
        ...config,
        id: '1',
        name: 'test'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalled();
      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(archiveMock).toHaveBeenCalledTimes(2);
    });

    it('should answer no', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['n']);

      const { mockEditionsList, deleteMock, archiveMock, mockGet } = mockValues({
        status: 'DRAFT',
        mixedEditions: true
      });

      const argv = {
        ...yargArgs,
        ...config,
        id: '1'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalled();
      expect(deleteMock).not.toHaveBeenCalled();
      expect(archiveMock).not.toHaveBeenCalled();
    });

    it('should error get hub', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockEditionsList, deleteMock, archiveMock, getHubMock, mockEventsList } = mockValues({
        status: 'DRAFT',
        getHubError: true
      });

      const argv = {
        ...yargArgs,
        ...config,
        name: '1'
      };
      await handler(argv);

      expect(getHubMock).toHaveBeenCalled();
      expect(mockEventsList).not.toHaveBeenCalled();
      expect(mockEditionsList).not.toHaveBeenCalled();
      expect(deleteMock).not.toHaveBeenCalled();
      expect(archiveMock).not.toHaveBeenCalled();
    });

    it('should error get hub', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockEditionsList, deleteMock, archiveMock, mockGet } = mockValues({
        status: 'DRAFT',
        getEventError: true
      });

      const argv = {
        ...yargArgs,
        ...config,
        id: '3'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockEditionsList).not.toHaveBeenCalled();
      expect(deleteMock).not.toHaveBeenCalled();
      expect(archiveMock).not.toHaveBeenCalled();
    });

    it('should archive events and write log file', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockEditionsList, deleteMock, mockGet } = mockValues({
        status: 'DRAFT'
      });

      const logFile = 'tmp/event-archive.log';

      const argv = {
        ...yargArgs,
        ...config,
        logFile,
        silent: false,
        id: '1'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalled();
      expect(deleteMock).toHaveBeenCalled();

      const logExists = await promisify(exists)(logFile);

      expect(logExists).toBeTruthy();

      const log = await promisify(readFile)(logFile, 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      logLines.forEach(line => {
        if (line.indexOf('DELETE') !== -1) {
          total++;
        }
      });

      expect(total).toEqual(1);

      await promisify(unlink)(logFile);
    });

    it('should return event file name', async () => {
      const logFile = LOG_FILENAME();

      expect(logFile).toContain('event-archive-<DATE>.log');
    });
  });

  describe('getEvents tests', () => {
    it('should get event by id', async () => {
      const result = await getEvents({
        client: dynamicContentClientFactory({
          ...config,
          ...yargArgs
        }),
        id: '1',
        hubId: 'hub1'
      });

      if (result) {
        expect(result.length).toBeGreaterThanOrEqual(1);

        expect(result[0].event.id).toMatch('1');
      }
    });

    it('should get events by name', async () => {
      const result = await getEvents({
        client: dynamicContentClientFactory({
          ...config,
          ...yargArgs
        }),
        hubId: 'hub1',
        name: '/test/'
      });

      if (result) {
        expect(result.length).toBe(2);
      }
    });

    it('should archive events, write log file', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      if (await promisify(exists)('temp/event-archive.log')) {
        await promisify(unlink)('temp/event-archive.log');
      }

      const { mockGet, mockEditionsList, archiveMock } = mockValues({ status: 'SHCEDULED' });

      const argv = {
        ...yargArgs,
        ...config,
        silent: false,
        logFile: 'temp/event-archive.log',
        id: '1'
      };

      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockEditionsList).toHaveBeenCalled();
      expect(archiveMock).toHaveBeenCalled();

      const logExists = await promisify(exists)('temp/event-archive.log');

      expect(logExists).toBeTruthy();

      const log = await promisify(readFile)('temp/event-archive.log', 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      logLines.forEach(line => {
        if (line.indexOf('ARCHIVE') !== -1) {
          total++;
        }
      });

      expect(total).toEqual(1);

      await promisify(unlink)('temp/event-archive.log');
    });
  });
});
