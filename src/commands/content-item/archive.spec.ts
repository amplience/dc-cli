import { builder, command, handler, LOG_FILENAME, getContentItems, processItems, coerceLog } from './archive';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentRepository, ContentItem, Folder, Status } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import readline from 'readline';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { dirname } from 'path';
import { promisify } from 'util';
import { exists, readFile, unlink, mkdir, writeFile } from 'fs';
import { FileLog, setVersion } from '../../common/file-log';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import * as fetchContentModule from '../../common/filter/fetch-content';

setVersion('test-ver');

jest.mock('readline');

jest.mock('../../services/dynamic-content-client-factory');

jest.mock('../../common/log-helpers', () => ({
  ...jest.requireActual('../../common/log-helpers'),
  getDefaultLogPath: jest.fn()
}));

jest.mock('../../common/filter/fetch-content');

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
    hubId: 'hub-id',
    logFile: new FileLog()
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
    mockFacet: () => void;
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
    const mockFacet = jest.spyOn(fetchContentModule, 'getContent') as jest.Mock;

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

    mockItemGetById.mockResolvedValue(contentItems[0]);

    mockItemUpdate.mockResolvedValue(contentItems[0]);

    mockArchive.mockResolvedValue(contentItems[0]);

    mockItemsList.mockResolvedValue(new MockPage(ContentItem, contentItems));

    mockFacet.mockResolvedValue(contentItems);

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
      mockFacet,
      contentItems
    };
  };

  it('should command should defined', function () {
    expect(command).toEqual('archive [id]');
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

      expect(spyOption).toHaveBeenCalledWith('facet', {
        type: 'string',
        describe:
          "Archive content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
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
        describe: 'Path to a log file to write to.',
        coerce: coerceLog
      });

      expect(spyOption).toHaveBeenCalledWith('ignoreSchemaValidation', {
        type: 'boolean',
        boolean: false,
        describe: 'Ignore content item schema validation during archive'
      });
    });
  });

  describe('handler tests', function () {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function () {
      LOG_FILENAME();

      expect(getDefaultLogPath).toHaveBeenCalledWith('content-item', 'archive', process.platform);
    });

    it('should generate a log with coerceLog with the appropriate title', function () {
      const logFile = coerceLog('filename.log');

      expect(logFile).toEqual(expect.any(FileLog));
      expect(logFile.title).toMatch(/^dc\-cli test\-ver \- Content Items Archive Log \- ./);
    });

    it('should archive all content', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockFacet, mockArchive } = mockValues();

      const argv = {
        ...yargArgs,
        ...config
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ACTIVE,
        enrichItems: true
      });
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content by id', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockItemGetById, mockFacet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        id: '1',
        repoId: 'repo123'
      };
      await handler(argv);

      expect(mockItemGetById).toHaveBeenCalled();
      expect(mockFacet).not.toHaveBeenCalled();
      expect(mockArchive).toBeCalledTimes(1);
    });

    it("shouldn't archive content by id", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockItemGetById, mockFacet } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        id: '1'
      };
      await handler(argv);

      expect(mockItemGetById).toHaveBeenCalled();
      expect(mockFacet).not.toHaveBeenCalled();
      expect(mockArchive).not.toBeCalled();
    });

    it('should archive content by repo id', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockArchive, mockFacet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        repoId: 'repo1'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ACTIVE,
        repoId: 'repo1',
        enrichItems: true
      });
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content by repo ids', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockArchive, mockFacet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        repoId: ['repo1', 'repo2']
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ACTIVE,
        repoId: ['repo1', 'repo2'],
        enrichItems: true
      });
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content by folder id', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockArchive, mockFacet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        repoId: 'repo123'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ACTIVE,
        folderId: 'folder1',
        repoId: 'repo123',
        enrichItems: true
      });
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content by folder ids', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockArchive, mockFacet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: ['folder1', 'folder1']
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ACTIVE,
        folderId: ['folder1', 'folder1'],
        enrichItems: true
      });
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content by name', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockArchive, mockFacet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        facet: 'name:item1'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'name:item1', {
        folderId: 'folder1',
        status: Status.ACTIVE,
        enrichItems: true
      });
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should exit if a facet AND id are provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockArchive, mockFolderGet, mockItemsList, mockFacet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        id: '123',
        facet: 'name:item1'
      };
      await handler(argv);

      expect(mockFacet).not.toBeCalled();
      expect(mockFolderGet).not.toBeCalled();
      expect(mockItemsList).not.toBeCalled();
      expect(mockArchive).not.toBeCalled();
    });

    it("shouldn't unarchive content when facet returns none", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockArchive, mockFacet } = mockValues();

      (mockFacet as jest.Mock).mockReset();
      (mockFacet as jest.Mock).mockResolvedValue([]);

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        facet: 'name:item3'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'name:item3', {
        folderId: 'folder1',
        status: Status.ACTIVE,
        enrichItems: true
      });
      expect(mockArchive).not.toBeCalled();
    });

    it("shouldn't archive content, answer no", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['n']);

      const { mockGet, mockArchive, mockFacet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1',
        name: 'item1'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'name:item1', {
        folderId: 'folder1',
        status: Status.ACTIVE,
        enrichItems: true
      });
      expect(mockArchive).not.toBeCalled();
    });

    it('should archive content by content type name', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockArchive, mockFacet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        facet: 'schema:http://test.com'
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'schema:http://test.com', {
        status: Status.ACTIVE,
        enrichItems: true
      });
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content with ignoreError', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockArchive, mockFacet } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        ignoreError: true
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ACTIVE,
        enrichItems: true
      });
      expect(mockArchive).toBeCalledTimes(2);
    });

    it("shouldn't archive content with ignoreError", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockGet, mockArchive, mockFacet } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        ignoreError: false
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ACTIVE,
        enrichItems: true
      });
      expect(mockArchive).toBeCalledTimes(1);
    });

    it('should archive content items without asking if --force is provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['input', 'ignored']);

      const { mockGet, mockArchive, mockFacet } = mockValues();

      const argv = {
        ...yargArgs,
        ...config,
        force: true
      };
      await handler(argv);

      expect(mockGet).toHaveBeenCalled();
      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        status: Status.ACTIVE,
        enrichItems: true
      });
      expect(mockArchive).toBeCalledTimes(2);
    });

    it('should archive content items specified in the provided --revertLog', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const logFileName = `temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`;
      const log = '// Type log test file\n' + 'UNARCHIVE 1\n' + 'UNARCHIVE 2\n' + 'UNARCHIVE idMissing\n';

      const dir = dirname(logFileName);
      if (!(await promisify(exists)(dir))) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);

      const { mockArchive, mockItemGetById, contentItems } = mockValues();

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
      expect(mockArchive).toBeCalledTimes(2);
    });

    it("shouldn't archive content items, getFacet error", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['input', 'ignored']);

      const { mockArchive, mockFacet } = mockValues(true);

      (mockFacet as jest.Mock).mockReset();
      (mockFacet as jest.Mock).mockRejectedValue(new Error('Simulated Error'));

      const argv = {
        ...yargArgs,
        ...config,
        folderId: 'folder1'
      };
      await handler(argv);

      expect(mockFacet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), undefined, {
        folderId: 'folder1',
        status: Status.ACTIVE,
        enrichItems: true
      });
      expect(mockArchive).not.toBeCalled();
    });

    it("shouldn't archive content items, revertLog error", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      if (await promisify(exists)(`temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`)) {
        await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`);
      }

      const logFileName = `temp_${process.env.JEST_WORKER_ID}/content-item-unarchive.log`;
      const log = '// Type log test file\n' + 'UNARCHIVE 1\n' + 'UNARCHIVE 2\n' + 'UNARCHIVE idMissing';

      const dir = dirname(logFileName);
      if (!(await promisify(exists)(dir))) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(logFileName, log);

      const { mockArchive, mockItemGetById, mockFacet } = mockValues(true);

      const argv = {
        ...yargArgs,
        ...config,
        silent: true,
        force: true,
        revertLog: 'wrongFileName.log'
      };
      await handler(argv);

      expect(mockItemGetById).not.toHaveBeenCalled();
      expect(mockFacet).not.toHaveBeenCalled();
      expect(mockArchive).not.toBeCalled();
    });

    it('should archive content items, write log file', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      if (await promisify(exists)(`temp_${process.env.JEST_WORKER_ID}/content-item-archive.log`)) {
        await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/content-item-archive.log`);
      }

      const { mockItemGetById, mockArchive, contentItems } = mockValues();

      contentItems[0].body._meta.deliveryKey = 'delivery-key';

      const argv = {
        ...yargArgs,
        ...config,
        logFile: createLog(`temp_${process.env.JEST_WORKER_ID}/content-item-archive.log`),
        id: '1'
      };

      await handler(argv);

      expect(mockItemGetById).toHaveBeenCalled();
      expect(mockArchive).toBeCalled();

      const logExists = await promisify(exists)(`temp_${process.env.JEST_WORKER_ID}/content-item-archive.log`);

      expect(logExists).toBeTruthy();

      const log = await promisify(readFile)(`temp_${process.env.JEST_WORKER_ID}/content-item-archive.log`, 'utf8');

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

      await promisify(unlink)(`temp_${process.env.JEST_WORKER_ID}/content-item-archive.log`);
    });

    it('should update content item with no additional params when delivery key is set', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockItemUpdate, contentItems } = mockValues();

      contentItems[0].body._meta.deliveryKey = 'delivery-key';
      const argv = {
        ...yargArgs,
        ...config
      };
      await handler(argv);

      expect(mockItemUpdate).toHaveBeenCalledTimes(1);
      // check we're not sending any update params
      expect((mockItemUpdate as jest.Mock).mock.calls[0][1]).toEqual({});
    });

    it('should update content item with ignoreSchemaValidation param when delivery key is set', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const { mockItemUpdate, contentItems } = mockValues();

      contentItems[0].body._meta.deliveryKey = 'delivery-key';
      const argv = {
        ...yargArgs,
        ...config,
        ignoreSchemaValidation: true
      };
      await handler(argv);

      expect(mockItemUpdate).toHaveBeenCalledTimes(1);
      expect((mockItemUpdate as jest.Mock).mock.calls[0][1].ignoreSchemaValidation).toBe(true);
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

  describe('processItems tests', () => {
    it('should archive content items', async () => {
      const { contentItems, mockArchive } = mockValues();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      await processItems({
        contentItems,
        allContent: true,
        missingContent: false,
        logFile: createLog('./logFile.log')
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
        missingContent: false,
        logFile: new FileLog()
      });

      expect(console.log).toBeCalled();
      expect(console.log).toHaveBeenLastCalledWith('Nothing found to archive, aborting.');
    });
  });
});
