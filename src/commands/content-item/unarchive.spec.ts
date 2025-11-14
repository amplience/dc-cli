import { builder, command, handler, LOG_FILENAME, coerceLog } from './unarchive';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentRepository, ContentItem, Folder, Status } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import readline from 'readline';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { dirname } from 'path';
import { promisify } from 'util';
import { unlink, mkdir, writeFile, readFile, existsSync } from 'fs';
import * as fetchContentModule from '../../common/filter/fetch-content';
import { FileLog, setVersion } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';

setVersion('test-ver');

jest.mock('readline');

jest.mock('../../services/dynamic-content-client-factory');

jest.mock('../../common/log-helpers', () => ({
  ...jest.requireActual('../../common/log-helpers'),
  getDefaultLogPath: jest.fn()
}));

jest.mock('../../common/filter/fetch-content');

describe('content-item unarchive command', () => {
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
    hubId: 'hub-id',
    logFile: new FileLog()
  };

  const mockValues = (
    unarchiveError = false
  ): {
    mockGet: () => void;
    mockGetList: () => void;
    mockItemsList: () => void;
    mockUnarchive: () => void;
    mockItemUpdate: () => void;
    mockItemGetById: () => void;
    mockRepoGet: () => void;
    mockFolderGet: () => void;
    mockGetContent: () => void;
    contentItems: ContentItem[];
  } => {
    const mockGet = jest.fn();
    const mockGetList = jest.fn();
    const mockItemsList = jest.fn();
    const mockUnarchive = jest.fn();
    const mockItemUpdate = jest.fn();
    const mockItemGetById = jest.fn();
    const mockRepoGet = jest.fn();
    const mockFolderGet = jest.fn();
    const mockGetContent = jest.spyOn(fetchContentModule, 'getContent') as jest.Mock;

    const item = new ContentItem({
      id: '1',
      label: 'item1',
      repoId: 'repo1',
      folderId: 'folder1',
      status: 'ARCHIVED',
      body: {
        _meta: {
          schema: 'http://test.com'
        }
      },
      client: {
        performActionThatReturnsResource: mockUnarchive
      },
      _links: {
        unarchive: {
          href: 'https://api.amplience.net/v2/content/content-items/1/unarchive'
        }
      }
    });

    const contentItems = [
      item,
      new ContentItem({
        id: '2',
        label: 'item2',
        repoId: 'repo1',
        folderId: 'folder1',
        status: 'ARCHIVED',
        body: {
          _meta: {
            schema: 'http://test1.com'
          }
        },
        client: {
          performActionThatReturnsResource: mockUnarchive
        },
        _links: {
          unarchive: {
            href: 'https://api.amplience.net/v2/content/content-items/2/unarchive'
          }
        }
      })
    ];

    contentItems[0].related.unarchive = mockUnarchive;
    contentItems[0].related.update = mockItemUpdate;
    contentItems[1].related.unarchive = mockUnarchive;
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
            href: 'https://api.amplience.net/v2/content/content-repositories/repo1/content-items{?folderId,page,projection,size,sort,status}',
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
              href: 'https://api.amplience.net/v2/content/content-repositories/repo1/content-items{?folderId,page,projection,size,sort,status}',
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
            href: 'https://api.amplience.net/v2/content/content-repositories/repo1/content-items{?folderId,page,projection,size,sort,status}',
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

    mockItemGetById.mockResolvedValue(item);
    mockUnarchive.mockResolvedValue(item);
    mockItemUpdate.mockResolvedValue(item);

    mockItemsList.mockResolvedValue(new MockPage(ContentItem, contentItems));
    mockGetContent.mockResolvedValue(contentItems);

    if (unarchiveError) {
      mockUnarchive.mockRejectedValue(new Error('Error'));
      mockFolderGet.mockRejectedValue(new Error('Error'));
      mockItemGetById.mockRejectedValue(new Error('Error'));
    }

    return {
      mockGet,
      mockGetList,
      mockItemsList,
      mockUnarchive,
      mockItemUpdate,
      mockItemGetById,
      mockRepoGet,
      mockFolderGet,
      mockGetContent,
      contentItems
    };
  };

  it('should command should defined', function () {
    expect(command).toEqual('unarchive [id]');
  });

  describe('builder tests', function () {
    it('should configure yargs', function () {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        type: 'string',
        describe:
          'The ID of a content item to be unarchived. If id is not provided, this command will unarchive ALL content items through all content repositories in the hub.'
      });

      expect(spyOption).toHaveBeenCalledWith('repoId', {
        type: 'string',
        describe: 'The ID of a content repository to search items in to be unarchived.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('folderId', {
        type: 'string',
        describe: 'The ID of a folder to search items in to be unarchived.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('facet', {
        type: 'string',
        describe:
          "Unarchive content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
      });

      expect(spyOption).toHaveBeenCalledWith('revertLog', {
        type: 'string',
        describe:
          'Path to a log file containing content items archived in a previous run of the archive command.\nWhen provided, archives all content items listed as ARCHIVE in the log file.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before unarchiving the found content.'
      });

      expect(spyOption).toHaveBeenCalledWith('s', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, no log file will be produced.'
      });

      expect(spyOption).toHaveBeenCalledWith('ignoreError', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, unarchive requests that fail will not abort the process.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: coerceLog
      });

      expect(spyOption).toHaveBeenCalledWith('name', {
        type: 'string',
        hidden: true
      });

      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        hidden: true
      });

      expect(spyOption).toHaveBeenCalledWith('ignoreSchemaValidation', {
        type: 'boolean',
        boolean: false,
        describe: 'Ignore content item schema validation during unarchive'
      });
    });
  });

  describe('handler tests', function () {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function () {
      LOG_FILENAME();

      expect(getDefaultLogPath).toHaveBeenCalledWith('content-item', 'unarchive', process.platform);
    });

    it('should generate a log with coerceLog with the appropriate title', function () {
      const logFile = coerceLog('filename.log');

      expect(logFile).toEqual(expect.any(FileLog));
      expect(logFile.title).toMatch(/^dc\-cli test\-ver \- Content Items Unarchive Log \- ./);
    });

    it('should unarchive all content', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockGetContent, mockUnarchive } = mockValues();

      const argv = {
        ...yargArgs,
        ...config
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it('should unarchive content by id', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockItemGetById } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        id: '1',
        repoId: 'repo123'
      };
      await handler(argv);

      expect(mockItemGetById).toHaveBeenCalled();
      expect(mockUnarchive).toHaveBeenCalledTimes(1);
    });

    it("shouldn't unarchive content by id", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockItemGetById } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        id: '1'
      };
      await handler(argv);

      expect(mockItemGetById).toHaveBeenCalled();
      expect(mockUnarchive).not.toHaveBeenCalled();
    });

    it('should unarchive content by repo id', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockGetContent } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        repoId: 'repo1'
      };
      await handler(argv);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        repoId: 'repo1',
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it('should unarchive content by repo ids', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockGetContent } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        repoId: ['repo1', 'repo2']
      };
      await handler(argv);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        repoId: ['repo1', 'repo2'],
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it('should unarchive content by folder id', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockGetContent } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        repoId: 'repo123'
      };
      await handler(argv);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        repoId: 'repo123',
        folderId: 'folder1',
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it('should unarchive content by folder ids', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockGetContent } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: ['folder1', 'folder1']
      };
      await handler(argv);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        folderId: ['folder1', 'folder1'],
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it('should unarchive content by name', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockGetContent } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        facet: 'name:item1'
      };
      await handler(argv);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'name:item1', {
        folderId: 'folder1',
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it('should exit if a facet AND id are provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockFolderGet, mockItemsList, mockGetContent } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        id: '123',
        facet: 'name:item1'
      };
      await handler(argv);

      expect(mockGetContent).not.toHaveBeenCalled();
      expect(mockFolderGet).not.toHaveBeenCalled();
      expect(mockItemsList).not.toHaveBeenCalled();
      expect(mockUnarchive).not.toHaveBeenCalled();
    });

    it("shouldn't unarchive content when facet returns none", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockGetContent } = mockValues();

      (mockGetContent as jest.Mock).mockReset();
      (mockGetContent as jest.Mock).mockResolvedValue([]);

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        facet: 'name:item3'
      };
      await handler(argv);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'name:item3', {
        folderId: 'folder1',
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).not.toHaveBeenCalled();
    });

    it("shouldn't unarchive content, answer no", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['n']);

      const { mockUnarchive, mockGetContent } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        facet: 'name:item1'
      };
      await handler(argv);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'name:item1', {
        folderId: 'folder1',
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).not.toHaveBeenCalled();
    });

    it('should unarchive content by content type name', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockGetContent } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        facet: 'schema:http://test.com'
      };
      await handler(argv);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'schema:http://test.com', {
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it('should unarchive content with ignoreError', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockGetContent } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        ignoreError: true
      };
      await handler(argv);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it("shouldn't unarchive content with ignoreError", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockUnarchive, mockGetContent } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        ignoreError: false
      };
      await handler(argv);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(1);
    });

    it('should unarchive content items without asking if --force is provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['input', 'ignored']);

      const { mockUnarchive, mockGetContent } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        force: true
      };
      await handler(argv);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it('should unarchive content items specified in the provided --revertLog maintaining deliveryKey', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const logFileName = `temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`;
      const log = '// Type log test file\n' + 'ARCHIVE 1\n' + 'ARCHIVE 2 delivery-key\n' + 'ARCHIVE idMissing\n';

      const dir = dirname(logFileName);
      if (!existsSync(dir)) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);

      const { mockUnarchive, mockItemUpdate, mockItemGetById, contentItems } = mockValues();

      (mockItemGetById as jest.Mock).mockReset();
      (mockItemGetById as jest.Mock).mockResolvedValueOnce(contentItems[0]);
      (mockItemGetById as jest.Mock).mockResolvedValueOnce(contentItems[1]);
      (mockItemGetById as jest.Mock).mockRejectedValue(new Error("Couldn't locate item"));

      const argv = {
        ...yargArgs,
        ...config,
        silent: true,
        force: true,
        revertLog: logFileName
      };
      await handler(argv);

      expect(mockItemGetById).toHaveBeenNthCalledWith(1, '1');
      expect(mockItemGetById).toHaveBeenNthCalledWith(2, '2');
      expect(mockItemGetById).toHaveBeenNthCalledWith(3, 'idMissing');
      expect(mockItemUpdate).toHaveBeenCalled();
      const updateItem: ContentItem = (mockItemUpdate as jest.Mock).mock.calls[0][0];
      expect(updateItem.body._meta.deliveryKey).toEqual('delivery-key');
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it('should unarchive content items specified in the provided --revertLog maintaining deliveryKeys', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const logFileName = `temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`;
      const log =
        '// Type log test file\n' +
        'ARCHIVE 1\n' +
        'ARCHIVE 2  delivery-key-1,delivery-key-2\n' +
        'ARCHIVE idMissing\n';

      const dir = dirname(logFileName);
      if (!existsSync(dir)) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);

      const { mockUnarchive, mockItemUpdate, mockItemGetById, contentItems } = mockValues();

      (mockItemGetById as jest.Mock).mockReset();
      (mockItemGetById as jest.Mock).mockResolvedValueOnce(contentItems[0]);
      (mockItemGetById as jest.Mock).mockResolvedValueOnce(contentItems[1]);
      (mockItemGetById as jest.Mock).mockRejectedValue(new Error("Couldn't locate item"));

      const argv = {
        ...yargArgs,
        ...config,
        silent: true,
        force: true,
        revertLog: logFileName
      };
      await handler(argv);

      expect(mockItemGetById).toHaveBeenNthCalledWith(1, '1');
      expect(mockItemGetById).toHaveBeenNthCalledWith(2, '2');
      expect(mockItemGetById).toHaveBeenNthCalledWith(3, 'idMissing');
      expect(mockItemUpdate).toHaveBeenCalled();
      const updateItem: ContentItem = (mockItemUpdate as jest.Mock).mock.calls[0][0];
      expect(updateItem.body._meta.deliveryKeys).toEqual({
        values: [{ value: 'delivery-key-1' }, { value: 'delivery-key-2' }]
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it('should unarchive content items specified in the provided --revertLog maintaining deliveryKey and deliveryKeys', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const logFileName = `temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`;
      const log =
        '// Type log test file\n' +
        'ARCHIVE 1\n' +
        'ARCHIVE 2 delivery-key delivery-key-1,delivery-key-2\n' +
        'ARCHIVE idMissing\n';

      const dir = dirname(logFileName);
      if (!existsSync(dir)) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);

      const { mockUnarchive, mockItemUpdate, mockItemGetById, contentItems } = mockValues();

      (mockItemGetById as jest.Mock).mockReset();
      (mockItemGetById as jest.Mock).mockResolvedValueOnce(contentItems[0]);
      (mockItemGetById as jest.Mock).mockResolvedValueOnce(contentItems[1]);
      (mockItemGetById as jest.Mock).mockRejectedValue(new Error("Couldn't locate item"));

      const argv = {
        ...yargArgs,
        ...config,
        silent: true,
        force: true,
        revertLog: logFileName
      };
      await handler(argv);

      expect(mockItemGetById).toHaveBeenNthCalledWith(1, '1');
      expect(mockItemGetById).toHaveBeenNthCalledWith(2, '2');
      expect(mockItemGetById).toHaveBeenNthCalledWith(3, 'idMissing');
      expect(mockItemUpdate).toHaveBeenCalled();
      const updateItem: ContentItem = (mockItemUpdate as jest.Mock).mock.calls[0][0];
      expect(updateItem.body._meta.deliveryKey).toEqual('delivery-key');
      expect(updateItem.body._meta.deliveryKeys).toEqual({
        values: [{ value: 'delivery-key-1' }, { value: 'delivery-key-2' }]
      });
      expect(mockUnarchive).toHaveBeenCalledTimes(2);
    });

    it("shouldn't unarchive content items, getFacet error", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['input', 'ignored']);

      const { mockGetContent, mockUnarchive } = mockValues(true);

      (mockGetContent as jest.Mock).mockReset();
      (mockGetContent as jest.Mock).mockRejectedValue(new Error('Simulated error'));

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1'
      };

      await expect(handler(argv)).rejects.toThrowErrorMatchingInlineSnapshot(`"Simulated error"`);

      expect(mockGetContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        folderId: 'folder1',
        status: Status.ARCHIVED
      });
      expect(mockUnarchive).not.toHaveBeenCalled();
    });

    it("shouldn't unarchive content items, revertLog error", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      if (existsSync(`temp_${process.env.JEST_WORKER_ID}/content-item-archive.log`)) {
        await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/content-item-archive.log`);
      }

      const logFileName = `temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`;
      const log = '// Type log test file\n' + 'ARCHIVE 1\n' + 'ARCHIVE 2\n' + 'ARCHIVE idMissing';

      const dir = dirname(logFileName);
      if (!existsSync(dir)) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);

      const { mockUnarchive, mockItemGetById, mockGetContent } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        silent: true,
        force: true,
        revertLog: 'wrongFileName.log'
      };
      await expect(handler(argv)).rejects.toThrowErrorMatchingInlineSnapshot(
        `"ENOENT: no such file or directory, open 'wrongFileName.log'"`
      );

      expect(mockItemGetById).not.toHaveBeenCalled();
      expect(mockGetContent).not.toHaveBeenCalled();
      expect(mockUnarchive).not.toHaveBeenCalled();
    });

    it('should unarchive content items, write log file', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      if (existsSync(`temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`)) {
        await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`);
      }

      const { mockItemGetById, mockUnarchive } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`),
        id: '1'
      };

      await handler(argv);

      expect(mockItemGetById).toHaveBeenCalled();
      expect(mockUnarchive).toHaveBeenCalled();

      const logExists = existsSync(`temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`);

      expect(logExists).toBeTruthy();

      const log = await promisify(readFile)(`temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`, 'utf8');

      const logLines = log.split('\n');
      let total = 0;
      logLines.forEach(line => {
        if (line.indexOf('ARCHIVE') !== -1) {
          total++;
        }
      });

      expect(total).toEqual(1);

      await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`);
    });

    it('should unarchive content items and ignore schema validation on content item update', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const logFileName = `temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`;
      const log = '// Type log test file\n' + 'ARCHIVE 1 delivery-key\n';

      const dir = dirname(logFileName);
      if (!existsSync(dir)) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);

      const { mockUnarchive, mockItemUpdate, mockItemGetById, contentItems } = mockValues();

      (mockItemGetById as jest.Mock).mockReset();
      (mockItemGetById as jest.Mock).mockResolvedValueOnce(contentItems[0]);
      const unarchivedContentItem = new ContentItem({
        id: '1',
        label: 'item1',
        repoId: 'repo1',
        folderId: 'folder1',
        status: 'ARCHIVED',
        body: {
          _meta: {
            schema: 'http://test.com'
          }
        },
        client: {
          updateLinkedResource: mockItemUpdate
        },
        _links: {
          archive: {
            href: 'https://api.amplience.net/v2/content/content-items/1/unarchive'
          },
          update: {
            href: 'https://api.amplience.net/v2/content/content-items/1'
          }
        }
      });
      (mockUnarchive as jest.Mock).mockResolvedValueOnce(unarchivedContentItem);

      const argv = {
        ...yargArgs,
        ...config,
        silent: true,
        force: true,
        revertLog: logFileName,
        ignoreSchemaValidation: true
      };
      await handler(argv);

      expect(mockItemGetById).toHaveBeenNthCalledWith(1, '1');
      expect(mockItemUpdate).toHaveBeenCalledTimes(1);
      expect((mockItemUpdate as jest.Mock).mock.calls[0][1].ignoreSchemaValidation).toBe(true);
    });

    it('should not archive content items', async () => {
      const { mockItemGetById, mockUnarchive } = mockValues();
      const logFile = new FileLog();
      const mockAppendFile = jest.fn();
      logFile.open = jest.fn().mockImplementation(() => {
        return {
          appendLine: mockAppendFile
        };
      });
      const argv = {
        ...yargArgs,
        ...config,
        id: 'repo123',
        logFile
      };

      (mockItemGetById as jest.Mock).mockResolvedValue([]);

      await handler(argv);

      expect(mockUnarchive).not.toHaveBeenCalled();
      expect(mockAppendFile).toHaveBeenCalled();
      expect(mockAppendFile).toHaveBeenLastCalledWith('Nothing found to unarchive, aborting');
    });
  });
});
