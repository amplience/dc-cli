import Yargs from 'yargs/yargs';
import readline from 'readline';
import { builder, coerceLog, command, handler, LOG_FILENAME } from './sync';
import { FileLog } from '../../common/file-log';

import { getContentByIds } from '../../common/content-item/get-content-items-by-ids';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentItem, Hub, Job } from 'dc-management-sdk-js';
import { getContent } from '../../common/filter/fetch-content';

jest.mock('readline');

const mockSync = jest.fn();
const mockOnIdle = jest.fn();
const mockFailedJobs = jest.fn();
jest.mock('./sync.service', () => {
  return {
    ContentItemSyncService: jest.fn().mockImplementation(() => {
      return {
        sync: mockSync,
        onIdle: mockOnIdle,
        failedJobs: mockFailedJobs
      };
    })
  };
});

jest.mock('../../common/content-item/get-content-items-by-ids', () => {
  return {
    getContentByIds: jest.fn()
  };
});
jest.mock('../../common/filter/fetch-content', () => {
  return {
    getContent: jest.fn()
  };
});
jest.mock('../../services/dynamic-content-client-factory');

describe('content-item sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should command should defined', function () {
    expect(command).toEqual('sync [id]');
  });

  describe('builder', () => {
    it('should configure command arguments', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        type: 'string',
        describe: `The ID of a content item to sync. If id is not provided, this command will sync ALL content items through all content repositories in the hub.`
      });

      expect(spyOption).toHaveBeenCalledWith('repoId', {
        type: 'string',
        describe: 'The ID of a content repository to search items in to be sync.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('folderId', {
        type: 'string',
        describe: 'The ID of a folder to search items in to be sync.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('facet', {
        type: 'string',
        describe:
          "Publish content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
      });

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before publishing the found content.'
      });

      expect(spyOption).toHaveBeenCalledWith('s', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, no log file will be produced.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: coerceLog
      });

      expect(spyOption).toHaveBeenCalledWith('destinationHubId', {
        type: 'string',
        describe: 'The ID of a destination hub to sync with.',
        requiresArg: true,
        demandOption: true
      });
    });
  });

  describe('handler', () => {
    const HUB_ID = '67d1c1c7642fa239dbe15164';
    const DEST_HUB_ID = '67d2a201642fa239dbe1523d';
    const globalArgs = {
      $0: 'test',
      _: ['test'],
      json: true,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      hubId: HUB_ID
    };

    const mockLog = {
      open: jest.fn().mockReturnValue({
        appendLine: jest.fn(),
        addComment: jest.fn(),
        close: jest.fn()
      })
    } as unknown as FileLog;

    it('should sync content item by id', async () => {
      const CONTENT_ITEM_ID = 'c5b659df-680e-4711-bfbe-84eaa10d76cc';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);
      const mockGetHub = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub.mockResolvedValue(new Hub({ id: HUB_ID }))
        }
      });
      (getContentByIds as unknown as jest.Mock).mockResolvedValue([
        new ContentItem({ id: CONTENT_ITEM_ID, body: { _meta: {} } })
      ]);

      mockSync.mockImplementation((destinationHubId, hub, contentItem, fn) => {
        fn(new Job({ id: '68e5289f0aba3024bde050f9', status: 'COMPLETE' }));
      });

      mockFailedJobs.mockReturnValue(0);

      await handler({
        ...globalArgs,
        id: CONTENT_ITEM_ID,
        destinationHubId: DEST_HUB_ID,
        logFile: mockLog
      });

      expect(getContentByIds).toHaveBeenCalledWith(expect.any(Object), [CONTENT_ITEM_ID]);
      expect(mockSync).toHaveBeenCalledTimes(1);
      expect(mockSync).toHaveBeenCalledWith(
        DEST_HUB_ID,
        expect.any(Hub),
        expect.any(ContentItem),
        expect.any(Function)
      );
    });
    it('should sync content items by query', async () => {
      const CONTENT_ITEM_ID = 'c5b659df-680e-4711-bfbe-84eaa10d76cc';
      const REPOSITORY_ID = 'c5b659df-680e-4711-bfbe-84eaa10d76cc';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);
      const mockGetHub = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub.mockResolvedValue(new Hub({ id: HUB_ID }))
        }
      });
      (getContent as unknown as jest.Mock).mockResolvedValue([
        new ContentItem({ id: CONTENT_ITEM_ID, body: { _meta: {} } })
      ]);

      mockSync.mockImplementation((destinationHubId, hub, contentItem, fn) => {
        fn(new Job({ id: '68e5289f0aba3024bde050f9', status: 'COMPLETE' }));
      });

      mockFailedJobs.mockReturnValue(0);

      await handler({
        ...globalArgs,
        repoId: REPOSITORY_ID,
        destinationHubId: DEST_HUB_ID,
        logFile: mockLog
      });

      expect(getContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Hub), undefined, {
        repoId: REPOSITORY_ID,
        folderId: undefined,
        enrichItems: true,
        status: 'ACTIVE'
      });
      expect(mockSync).toHaveBeenCalledTimes(1);
      expect(mockSync).toHaveBeenCalledWith(
        DEST_HUB_ID,
        expect.any(Hub),
        expect.any(ContentItem),
        expect.any(Function)
      );
    });
  });
});
