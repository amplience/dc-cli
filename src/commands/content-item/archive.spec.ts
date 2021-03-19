import { builder, command, handler, LOG_FILENAME, filterContentItems, getContentItems, processItems } from './archive';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentRepository, ContentItem, Folder } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import readline from 'readline';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { dirname } from 'path';
import { promisify } from 'util';
import { exists, readFile, unlink, mkdir, writeFile } from 'fs';

jest.mock('readline');

jest.mock('../../services/dynamic-content-client-factory');

describe('content-item archive command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });
  const yargArgs = {
    $0: 'test',
    _: ['test'],
    json: true
  };
  const config = {
    clientId: 'client-id',
    clientSecret: 'client-id',
    hubId: 'hub-id'
  };

  const mockValues = (
    archiveError = false
  ): {
    mockGet: () => void;
    mockGetList: () => void;
    mockItemsList: () => void;
    mockArchive: () => void;
    mockItemGetById: () => void;
    mockItemUpdate: () => void;
    mockRepoGet: () => void;
    mockFolderGet: () => void;
    contentItems: ContentItem[];
  } => {
    const mockGet = jest.fn();
    const mockGetList = jest.fn();
    const mockItemsList = jest.fn();
    const mockArchive = jest.fn();
    const mockItemGetById = jest.fn();
    const mockItemUpdate = jest.fn();
    const mockRepoGet = jest.fn();
    const mockFolderGet = jest.fn();

    const contentItems = [
      new ContentItem({
        id: '1',
        label: 'item1',
        repoId: 'repo1',
        folderId: 'folder1',
        status: 'ACTIVE',
        body: {
          _meta: {
            schema: 'http://test.com'
          }
        },
        client: {
          performActionThatReturnsResource: mockArchive,
          updateResource: mockItemUpdate
        },
        _links: {
          archive: {
            href: 'https://api.amplience.net/v2/content/content-items/1/archive'
          }
        }
      }),
      new ContentItem({
        id: '2',
        label: 'item2',
        repoId: 'repo1',
        folderId: 'folder1',
        status: 'ACTIVE',
        body: {
          _meta: {
            schema: 'http://test1.com'
          }
        },
        client: {
          performActionThatReturnsResource: mockArchive,
          updateResource: mockItemUpdate
        },
        _links: {
          archive: {
            href: 'https://api.amplience.net/v2/content/content-items/2/archive'
          }
        }
      })
    ];

    contentItems[0].related.archive = mockArchive;
    contentItems[0].related.update = mockItemUpdate;
    contentItems[1].related.archive = mockArchive;
    contentItems[1].related.update = mockItemUpdate;

    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      hubs: {
        get: mockGet
      },
      contentRepositories: {
        get: mockRepoGet
      },
      contentItems: {
        get: mockItemGetById
      },
      folders: {
        get: mockFolderGet
      }
    });

    mockFolderGet.mockResolvedValue(
      new Folder({
        name: 'folder1',
        id: 'folder1',
        client: {
          fetchLinkedResource: mockItemsList
        },
        _links: {
          'content-items': {
            href:
              'https://api.amplience.net/v2/content/content-repositories/repo1/content-items{?folderId,page,projection,size,sort,status}',
            templated: true
          }
        },
        related: {
          contentItems: {
            list: mockItemsList
          }
        }
      })
    );

    mockGet.mockResolvedValue({
      id: 'hub-id',
      related: {
        contentRepositories: {
          list: mockGetList
        }
      }
    });

    mockGetList.mockResolvedValue(
      new MockPage(ContentRepository, [
        new ContentRepository({
          name: 'repo1',
          client: {
            fetchLinkedResource: mockItemsList
          },
          _links: {
            'content-items': {
              href:
                'https://api.amplience.net/v2/content/content-repositories/repo1/content-items{?folderId,page,projection,size,sort,status}',
              templated: true
            }
          },
          related: {
            contentItems: {
              list: mockItemsList
            }
          }
        })
      ])
    );

    mockRepoGet.mockResolvedValue(
      new ContentRepository({
        name: 'repo1',
        client: {
          fetchLinkedResource: mockItemsList
        },
        _links: {
          'content-items': {
            href:
              'https://api.amplience.net/v2/content/content-repositories/repo1/content-items{?folderId,page,projection,size,sort,status}',
            templated: true
          }
        },
        related: {
          contentItems: {
            list: mockItemsList
          }
        }
      })
    );

    mockItemGetById.mockResolvedValue(contentItems[0]);

    mockItemUpdate.mockResolvedValue(contentItems[0]);

    mockArchive.mockResolvedValue(contentItems[0]);

    mockItemsList.mockResolvedValue(new MockPage(ContentItem, contentItems));

    if (archiveError) {
      mockArchive.mockRejectedValue(new Error('Error'));
      mockFolderGet.mockRejectedValue(new Error('Error'));
      mockItemGetById.mockRejectedValue(new Error('Error'));
    }

    return {
      mockGet,
      mockGetList,
      mockItemsList,
      mockArchive,
      mockItemGetById,
      mockItemUpdate,
      mockRepoGet,
      mockFolderGet,
      contentItems
    };
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
        describe:
          'The ID of a content item to be archived. If id is not provided, this command will archive ALL content items through all content repositories in the hub.'
      });

      expect(spyOption).toHaveBeenCalledWith('repoId', {
        type: 'string',
        describe: 'The ID of a content repository to search items in to be archived.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('folderId', {
        type: 'string',
        describe: 'The ID of a folder to search items in to be archived.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('name', {
        type: 'string',
        describe:
          'The name of a Content Item to be archived.\nA regex can be provided to select multiple items with similar or matching names (eg /.header/).\nA single --name option may be given to match a single content item pattern.\nMultiple --name options may be given to match multiple content items patterns at the same time, or even multiple regex.'
      });

      expect(spyOption).toHaveBeenCalledWith('contentType', {
        type: 'string',
        describe:
          'A pattern which will only archive content items with a matching Content Type Schema ID. A single --contentType option may be given to match a single schema id pattern.\\nMultiple --contentType options may be given to match multiple schema patterns at the same time.'
      });

      expect(spyOption).toHaveBeenCalledWith('revertLog', {
        type: 'string',
        describe:
          'Path to a log file containing content items unarchived in a previous run of the unarchive command.\nWhen provided, archives all content items listed as UNARCHIVE in the log file.',
        requiresArg: false
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

      expect(spyOption).toHaveBeenCalledWith('ignoreError', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, archive requests that fail will not abort the process.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.'
      });
    });
  });

  describe('handler tests', function() {
    it('should archive all content', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockGetList, mockItemsList, mockArchive } = mockValues();

      const argv = {
        ...yargArgs,
        ...config
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockGetList).toHaveBeenCalled();
      expect(mockItemsList).toHaveBeenCalled();
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content by id', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockItemGetById } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        id: '1',
        repoId: 'repo123'
      };
      await handler(argv);

      expect(mockItemGetById).toHaveBeenCalled();
      expect(mockArchive).toBeCalledTimes(1);
    });

    it("shouldn't archive content by id", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockItemGetById } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        id: '1'
      };
      await handler(argv);

      expect(mockItemGetById).toHaveBeenCalled();
      expect(mockArchive).not.toBeCalled();
    });

    it('should archive content by repo id', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockRepoGet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        repoId: 'repo1'
      };
      await handler(argv);

      expect(mockRepoGet).toBeCalledTimes(1);
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content by repo ids', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockRepoGet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        repoId: ['repo1', 'repo2']
      };
      await handler(argv);

      expect(mockRepoGet).toBeCalledTimes(2);
      expect(mockArchive).toBeCalledTimes(4);
    });

    it('should archive content by folder id', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockFolderGet, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        repoId: 'repo123'
      };
      await handler(argv);

      expect(mockFolderGet).toBeCalledTimes(1);
      expect(mockItemsList).toBeCalledTimes(1);
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content by folder ids', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockFolderGet, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: ['folder1', 'folder1']
      };
      await handler(argv);

      expect(mockFolderGet).toBeCalledTimes(2);
      expect(mockItemsList).toBeCalledTimes(2);
      expect(mockArchive).toBeCalledTimes(4);
    });

    it('should archive content by name', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockFolderGet, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        name: 'item1'
      };
      await handler(argv);

      expect(mockFolderGet).toBeCalledTimes(1);
      expect(mockItemsList).toBeCalledTimes(1);
      expect(mockArchive).toBeCalledTimes(1);
    });

    it('should ented', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockFolderGet, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        id: '123',
        name: 'item1'
      };
      await handler(argv);

      expect(mockFolderGet).not.toBeCalled();
      expect(mockItemsList).not.toBeCalled();
      expect(mockArchive).not.toBeCalled();
    });

    it("shouldn't archive content by name", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockFolderGet, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        name: ['item3']
      };
      await handler(argv);

      expect(mockFolderGet).toBeCalledTimes(1);
      expect(mockItemsList).toBeCalledTimes(1);
      expect(mockArchive).not.toBeCalled();
    });

    it("shouldn't archive content, answer no", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['n']);

      const { mockArchive, mockFolderGet, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        name: 'item1'
      };
      await handler(argv);

      expect(mockFolderGet).toBeCalledTimes(1);
      expect(mockItemsList).toBeCalledTimes(1);
      expect(mockArchive).not.toBeCalled();
    });

    it('should archive content by name regexp', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockGetList, mockArchive, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        name: '/item/'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockGetList).toHaveBeenCalled();
      expect(mockItemsList).toHaveBeenCalled();
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content by content type name', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockGetList, mockArchive, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        contentType: 'http://test.com'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockGetList).toHaveBeenCalled();
      expect(mockItemsList).toHaveBeenCalled();
      expect(mockArchive).toBeCalledTimes(1);
    });

    it('should archive content by content type regexp', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockGetList, mockArchive, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        contentType: '/test/'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockGetList).toHaveBeenCalled();
      expect(mockItemsList).toHaveBeenCalled();
      expect(mockArchive).toBeCalledTimes(2);
    });

    it("shouldn't archive content by content type regexp", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockGetList, mockArchive, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        contentType: '/test123/'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockGetList).toHaveBeenCalled();
      expect(mockItemsList).toHaveBeenCalled();
      expect(mockArchive).toBeCalledTimes(0);
    });

    it('should archive content with ignoreError', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockGetList, mockArchive, mockItemsList } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        ignoreError: true
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockGetList).toHaveBeenCalled();
      expect(mockItemsList).toHaveBeenCalled();
      expect(mockArchive).toBeCalledTimes(2);
    });

    it("shouldn't archive content with ignoreError", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockGetList, mockArchive, mockItemsList } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        ignoreError: false
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockGetList).toHaveBeenCalled();
      expect(mockItemsList).toHaveBeenCalled();
      expect(mockArchive).toBeCalledTimes(1);
    });

    it('should archive content items without asking if --force is provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['input', 'ignored']);

      const { mockGet, mockGetList, mockArchive, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        force: true
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockGetList).toHaveBeenCalled();
      expect(mockItemsList).toHaveBeenCalled();
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content items specified in the provided --revertLog', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const logFileName = 'temp/content-item-unarchive.log';
      const log = '// Type log test file\n' + 'UNARCHIVE 1\n' + 'UNARCHIVE 2\n' + 'UNARCHIVE idMissing';

      const dir = dirname(logFileName);
      if (!(await promisify(exists)(dir))) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);

      const { mockGet, mockGetList, mockArchive, mockItemsList } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        silent: true,
        force: true,
        revertLog: logFileName
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockGetList).toHaveBeenCalled();
      expect(mockItemsList).toHaveBeenCalled();
      expect(mockArchive).toBeCalledTimes(2);
    });

    it("shouldn't archive content items, getFolder error", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['input', 'ignored']);

      const { mockFolderGet, mockArchive, mockItemsList } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1'
      };
      await handler(argv);

      expect(mockFolderGet).toBeCalledTimes(1);
      expect(mockItemsList).not.toBeCalled();
      expect(mockArchive).not.toBeCalled();
    });

    it("shouldn't archive content items, revertLog error", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      if (await promisify(exists)('temp/content-item-unarchive.log')) {
        await promisify(unlink)('temp/content-item-unarchive.log');
      }

      const logFileName = 'temp/content-item-unarchive.log';
      const log = '// Type log test file\n' + 'UNARCHIVE 1\n' + 'UNARCHIVE 2\n' + 'UNARCHIVE idMissing';

      const dir = dirname(logFileName);
      if (!(await promisify(exists)(dir))) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);

      const { mockGet, mockGetList, mockArchive, mockItemsList } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        logFile: LOG_FILENAME(),
        silent: true,
        force: true,
        revertLog: 'wrongFileName.log'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockGetList).toHaveBeenCalled();
      expect(mockItemsList).toHaveBeenCalled();
      expect(mockArchive).not.toBeCalled();
    });

    it('should archive content items, write log file', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      if (await promisify(exists)('temp/content-item-archive.log')) {
        await promisify(unlink)('temp/content-item-archive.log');
      }

      const { mockItemGetById, mockArchive, contentItems } = mockValues();

      contentItems[0].body._meta.deliveryKey = 'delivery-key';

      const argv = {
        ...yargArgs,
        ...config,
        logFile: 'temp/content-item-archive.log',
        id: '1'
      };

      await handler(argv);

      expect(mockItemGetById).toHaveBeenCalled();
      expect(mockArchive).toBeCalled();

      const logExists = await promisify(exists)('temp/content-item-archive.log');

      expect(logExists).toBeTruthy();

      const log = await promisify(readFile)('temp/content-item-archive.log', 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      let deliveryKeys = 0;
      logLines.forEach(line => {
        if (line.indexOf('ARCHIVE') !== -1) {
          total++;
        }

        if (line.indexOf('delivery-key') !== -1) {
          deliveryKeys++;
        }
      });

      expect(total).toEqual(1);
      expect(deliveryKeys).toEqual(1);

      await promisify(unlink)('temp/content-item-archive.log');
    });
  });

  describe('getContentItems tests', () => {
    it('should get content items by id', async () => {
      const result = await getContentItems({
        client: dynamicContentClientFactory({
          ...config,
          ...yargArgs
        }),
        id: '1',
        hubId: 'hub1'
      });

      if (result) {
        expect(result.contentItems.length).toBeGreaterThanOrEqual(1);

        expect(result.contentItems[0].id).toMatch('1');
      }
    });

    it('should get content items all', async () => {
      const result = await getContentItems({
        client: dynamicContentClientFactory({
          ...config,
          ...yargArgs
        }),
        hubId: 'hub1'
      });

      if (result) {
        expect(result.contentItems.length).toBe(2);
      }
    });

    it('should get content items by repo', async () => {
      const result = await getContentItems({
        client: dynamicContentClientFactory({
          ...config,
          ...yargArgs
        }),
        hubId: 'hub1',
        repoId: 'repo1'
      });

      if (result) {
        expect(result.contentItems.length).toBe(2);
      }
    });

    it('should get content items by folder', async () => {
      const result = await getContentItems({
        client: dynamicContentClientFactory({
          ...config,
          ...yargArgs
        }),
        hubId: 'hub1',
        folderId: 'folder1'
      });

      if (result) {
        expect(result.contentItems.length).toBe(2);
      }
    });
  });

  describe('filterContentItems tests', () => {
    it('should filter content items', async () => {
      const { contentItems } = mockValues();

      const result = await filterContentItems({
        contentItems
      });

      expect(result).toMatchObject({
        contentItems,
        missingContent: false
      });
    });

    it('should filter content items by content type', async () => {
      const { contentItems } = mockValues();

      const result = await filterContentItems({
        contentItems,
        contentType: '/test.com/'
      });

      expect(result).toMatchObject({
        contentItems: [contentItems[0]],
        missingContent: false
      });
    });

    it('should filter content items by content types', async () => {
      const { contentItems } = mockValues();

      const result = await filterContentItems({
        contentItems,
        contentType: ['/test.com/', '/test1.com/']
      });

      expect(result).toMatchObject({
        contentItems,
        missingContent: false
      });
    });

    it('should filter content items by name', async () => {
      const { contentItems } = mockValues();

      const result = await filterContentItems({
        contentItems,
        name: ['/item1/']
      });

      if (result) {
        expect(result.contentItems.length).toBeGreaterThanOrEqual(1);

        expect(result.contentItems[0].id).toMatch('1');
      }
    });
  });

  describe('processItems tests', () => {
    it('should archive content items', async () => {
      const { contentItems, mockArchive } = mockValues();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      await processItems({
        contentItems,
        allContent: true,
        missingContent: false,
        logFile: './logFile.log'
      });

      expect(mockArchive).toBeCalledTimes(2);

      if (await promisify(exists)('./logFile.log')) {
        await promisify(unlink)('./logFile.log');
      }
    });

    it('should not archive content items', async () => {
      jest.spyOn(global.console, 'log');

      await processItems({
        contentItems: [],
        allContent: true,
        missingContent: false
      });

      expect(console.log).toBeCalled();
      expect(console.log).toHaveBeenLastCalledWith('Nothing found to archive, aborting.');
    });
  });
});
