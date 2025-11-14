import { builder, handler, LOG_FILENAME, coerceLog } from './publish';
import { ContentItem, Hub, PublishingJob, Job } from 'dc-management-sdk-js';
import { FileLog } from '../../common/file-log';
import Yargs from 'yargs/yargs';
import { PublishingJobStatus } from 'dc-management-sdk-js/build/main/lib/model/PublishingJobStatus';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { getContentByIds } from '../../common/content-item/get-content-items-by-ids';
import { getContent } from '../../common/filter/fetch-content';
import * as confirmAllContentModule from '../../common/content-item/confirm-all-content';
import * as questionHelpers from '../../common/question-helpers';

const mockPublish = jest.fn().mockImplementation((contentItems, fn) => {
  fn(contentItems, new PublishingJob({ state: PublishingJobStatus.CREATED }));
});
const mockCheck = jest.fn().mockImplementation((publishingJob, fn) => {
  fn(new PublishingJob({ state: PublishingJobStatus.COMPLETED }));
});
const mockPublishOnIdle = jest.fn().mockImplementation(() => Promise.resolve());
const mockCheckOnIdle = jest.fn().mockImplementation(() => Promise.resolve());

const confirmAllContentSpy = jest.spyOn(confirmAllContentModule, 'confirmAllContent');
const asyncQuestionSpy = jest.spyOn(questionHelpers, 'asyncQuestion');

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../common/log-helpers');
jest.mock('../../common/filter/fetch-content');
jest.mock('../../common/content-item/get-content-items-by-ids', () => {
  return {
    getContentByIds: jest.fn()
  };
});
jest.mock('../../common/publishing/content-item-publishing-service', () => {
  return {
    ContentItemPublishingService: jest.fn().mockImplementation(() => {
      return {
        publish: mockPublish,
        onIdle: mockPublishOnIdle
      };
    })
  };
});
jest.mock('../../common/publishing/content-item-publishing-job-service', () => {
  return {
    ContentItemPublishingJobService: jest.fn().mockImplementation(() => {
      return {
        check: mockCheck,
        onIdle: mockCheckOnIdle
      };
    })
  };
});

describe('publish tests', () => {
  describe('builder tests', () => {
    it('should configure yargs', function () {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        type: 'string',
        describe:
          'The ID of a content item to be published. If id is not provided, this command will publish ALL content items through all content repositories in the hub.'
      });

      expect(spyOption).toHaveBeenCalledWith('repoId', {
        type: 'string',
        describe: 'The ID of a content repository to search items in to be published.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('folderId', {
        type: 'string',
        describe: 'The ID of a folder to search items in to be published.',
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
    });
  });

  describe('handler', () => {
    const HUB_ID = '67d1c1c7642fa239dbe15164';
    const CONTENT_ITEM_ID = 'c5b659df-680e-4711-bfbe-84eaa10d76cc';
    const globalArgs = {
      $0: 'test',
      _: ['test'],
      json: true,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      hubId: HUB_ID
    };

    const mockAppendLine = jest.fn();
    const mockLog = {
      open: jest.fn().mockReturnValue({
        appendLine: mockAppendLine,
        addComment: jest.fn(),
        close: jest.fn()
      })
    } as unknown as FileLog;

    beforeEach(() => {
      jest.clearAllMocks();
      confirmAllContentSpy.mockResolvedValue(true);
      asyncQuestionSpy.mockResolvedValue(true);
    });

    it('should publish content item by id', async () => {
      const mockGetHub = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub.mockResolvedValue(new Hub({ id: HUB_ID }))
        }
      });
      (getContentByIds as unknown as jest.Mock).mockResolvedValue([
        new ContentItem({ id: CONTENT_ITEM_ID, body: { _meta: {} } })
      ]);

      mockPublish.mockImplementation((contentItem, fn) => {
        fn(new Job({ id: '68e5289f0aba3024bde050f9', status: 'COMPLETE' }));
      });

      await handler({
        ...globalArgs,
        id: CONTENT_ITEM_ID,
        logFile: mockLog
      });

      expect(getContentByIds).toHaveBeenCalledWith(expect.any(Object), [CONTENT_ITEM_ID]);
      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublish).toHaveBeenCalledWith(expect.any(ContentItem), expect.any(Function));
      expect(mockPublishOnIdle).toHaveBeenCalledTimes(1);
      expect(mockCheck).toHaveBeenCalledTimes(1);
      expect(mockCheckOnIdle).toHaveBeenCalledTimes(1);
    });
    it('should publish content items by query', async () => {
      const REPOSITORY_ID = '67d1c1cf642fa239dbe15165';
      const mockGetHub = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub.mockResolvedValue(new Hub({ id: HUB_ID }))
        }
      });
      (getContent as unknown as jest.Mock).mockResolvedValue([
        new ContentItem({ id: CONTENT_ITEM_ID, body: { _meta: {} } })
      ]);

      mockPublish.mockImplementation((contentItem, fn) => {
        fn(new Job({ id: '68e5289f0aba3024bde050f9', status: 'COMPLETE' }));
      });

      await handler({
        ...globalArgs,
        repoId: REPOSITORY_ID,
        logFile: mockLog
      });

      expect(getContent).toHaveBeenCalledWith(expect.any(Object), expect.any(Hub), undefined, {
        enrichItems: true,
        folderId: undefined,
        repoId: REPOSITORY_ID,
        status: 'ACTIVE'
      });
      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublish).toHaveBeenCalledWith(expect.any(ContentItem), expect.any(Function));
      expect(mockPublishOnIdle).toHaveBeenCalledTimes(1);
      expect(mockCheck).toHaveBeenCalledTimes(1);
      expect(mockCheckOnIdle).toHaveBeenCalledTimes(1);
    });

    it('should process all items while filtering out any dependencies and call publish', async () => {
      const contentItemWithDependency = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-111111111111',
        label: 'Publish me',
        body: {
          _meta: {},
          dependency: {
            _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
            contentType: 'http://bigcontent.io/cms/schema/v1/text',
            id: 'da2ee918-34c3-4fc1-ae05-222222222222'
          }
        }
      });
      const contentItemDependency = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-222222222222',
        label: 'No need to publish me',
        body: { _meta: {} }
      });
      const mockGetHub = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub.mockResolvedValue(new Hub({ id: HUB_ID }))
        }
      });
      (getContentByIds as unknown as jest.Mock).mockResolvedValue([contentItemWithDependency, contentItemDependency]);

      mockPublish.mockImplementation((contentItem, fn) => {
        fn(new Job({ id: '68e5289f0aba3024bde050f9', status: 'COMPLETE' }));
      });

      await handler({
        ...globalArgs,
        id: [contentItemWithDependency.id, contentItemDependency.id],
        logFile: mockLog
      });

      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublish).toHaveBeenCalledWith(contentItemWithDependency, expect.any(Function));
      expect(mockPublishOnIdle).toHaveBeenCalledTimes(1);
      expect(mockCheck).toHaveBeenCalledTimes(1);
      expect(mockCheckOnIdle).toHaveBeenCalledTimes(1);
    });

    it('should exit before processing content items if confirmation to proceed is rejected', async () => {
      confirmAllContentSpy.mockResolvedValue(false);
      const mockGetHub = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub.mockResolvedValue(new Hub({ id: HUB_ID }))
        }
      });
      (getContentByIds as unknown as jest.Mock).mockResolvedValue([
        new ContentItem({ id: CONTENT_ITEM_ID, body: { _meta: {} } })
      ]);

      await handler({
        ...globalArgs,
        id: CONTENT_ITEM_ID,
        logFile: mockLog
      });
      expect(mockPublish).not.toHaveBeenCalled();
      expect(mockPublishOnIdle).not.toHaveBeenCalled();
      expect(mockCheck).not.toHaveBeenCalled();
      expect(mockCheckOnIdle).not.toHaveBeenCalled();
    });

    it('should not check publishing jobs if check question is rejected', async () => {
      asyncQuestionSpy.mockResolvedValue(false);
      const mockGetHub = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub.mockResolvedValue(new Hub({ id: HUB_ID }))
        }
      });
      (getContentByIds as unknown as jest.Mock).mockResolvedValue([
        new ContentItem({ id: 'CONTENT_ITEM_ID_ZZZZZZZZZ', body: { _meta: {} } })
      ]);

      mockPublish.mockImplementation((contentItem, fn) => {
        fn(new Job({ id: '68e5289f0aba3024bde050f9', status: 'COMPLETE' }));
      });

      await handler({
        ...globalArgs,
        id: 'CONTENT_ITEM_ID_ZZZZZZZZZ',
        logFile: mockLog
      });

      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublishOnIdle).toHaveBeenCalledTimes(1);
      expect(mockCheck).not.toHaveBeenCalled();
      expect(mockCheckOnIdle).not.toHaveBeenCalled();
    });

    it('should exit early if ID or query args are not passed', async () => {
      await handler({
        ...globalArgs,
        id: CONTENT_ITEM_ID,
        facet: 'mock-facet',
        logFile: mockLog
      });
      expect(mockAppendLine).toHaveBeenCalledWith('Please specify either a facet or an ID - not both');
      expect(mockPublish).not.toHaveBeenCalled();
      expect(mockPublishOnIdle).not.toHaveBeenCalled();
      expect(mockCheck).not.toHaveBeenCalled();
      expect(mockCheckOnIdle).not.toHaveBeenCalled();
    });

    it('should exit early if no content items', async () => {
      const mockGetHub = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub.mockResolvedValue(new Hub({ id: HUB_ID }))
        }
      });
      (getContentByIds as unknown as jest.Mock).mockResolvedValue([]);
      await handler({
        ...globalArgs,
        id: CONTENT_ITEM_ID,
        logFile: mockLog
      });
      expect(mockAppendLine).toHaveBeenCalledWith('Nothing found to publish, aborting');
      expect(mockPublish).not.toHaveBeenCalled();
      expect(mockPublishOnIdle).not.toHaveBeenCalled();
      expect(mockCheck).not.toHaveBeenCalled();
      expect(mockCheckOnIdle).not.toHaveBeenCalled();
    });
  });
});
