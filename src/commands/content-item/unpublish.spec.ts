import { builder, handler, LOG_FILENAME, coerceLog } from './unpublish';
import { ContentItem, Hub, PublishingJob, Job, ContentItemPublishingStatus } from 'dc-management-sdk-js';
import { FileLog } from '../../common/file-log';
import Yargs from 'yargs/yargs';
import { PublishingJobStatus } from 'dc-management-sdk-js/build/main/lib/model/PublishingJobStatus';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { getContentByIds } from '../../common/content-item/get-content-items-by-ids';
import { getContent } from '../../common/filter/fetch-content';
import * as confirmAllContentModule from '../../common/content-item/confirm-all-content';
import * as questionHelpers from '../../common/question-helpers';

const mockUnpublish = jest.fn().mockImplementation((contentItems, fn) => {
  fn(contentItems, new PublishingJob({ state: PublishingJobStatus.CREATED }));
});
const mockUnpublishOnIdle = jest.fn().mockImplementation(() => Promise.resolve());

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
jest.mock('../../common/publishing/content-item-unpublishing-service', () => {
  return {
    ContentItemUnpublishingService: jest.fn().mockImplementation(() => {
      return {
        unpublish: mockUnpublish,
        onIdle: mockUnpublishOnIdle
      };
    })
  };
});

describe('unpublish tests', () => {
  describe('builder tests', () => {
    it('should configure yargs', function () {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        type: 'string',
        describe:
          'The ID of a content item to be unpublished. If id is not provided, this command will unpublish ALL content items through all content repositories in the hub.'
      });

      expect(spyOption).toHaveBeenCalledWith('repoId', {
        type: 'string',
        describe: 'The ID of a content repository to search items in to be unpublished.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('folderId', {
        type: 'string',
        describe: 'The ID of a folder to search items in to be unpublished.',
        requiresArg: false
      });

      expect(spyOption).toHaveBeenCalledWith('facet', {
        type: 'string',
        describe:
          "Unpublish content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
      });

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before unpublishing the found content.'
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

      mockUnpublish.mockImplementation((contentItem, fn) => {
        fn(new Job({ id: '68e5289f0aba3024bde050f9', status: 'COMPLETE' }));
      });

      await handler({
        ...globalArgs,
        id: CONTENT_ITEM_ID,
        logFile: mockLog
      });

      expect(getContentByIds).toHaveBeenCalledWith(expect.any(Object), [CONTENT_ITEM_ID]);
      expect(mockUnpublish).toHaveBeenCalledTimes(1);
      expect(mockUnpublish).toHaveBeenCalledWith(expect.any(ContentItem), expect.any(Function));
      expect(mockUnpublishOnIdle).toHaveBeenCalledTimes(1);
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

      mockUnpublish.mockImplementation((contentItem, fn) => {
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
      expect(mockUnpublish).toHaveBeenCalledTimes(1);
      expect(mockUnpublish).toHaveBeenCalledWith(expect.any(ContentItem), expect.any(Function));
      expect(mockUnpublishOnIdle).toHaveBeenCalledTimes(1);
    });

    it('should process only process content items with an unpublishable status', async () => {
      const publishedContentItem = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-111111111111',
        label: 'Published - unpublish me',
        publishingStatus: ContentItemPublishingStatus.LATEST,
        body: {
          _meta: {},
          text: 'text 1'
        }
      });
      const unpublishedContentItemDependency = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-222222222222',
        label: 'Already unpublished - ignore me',
        publishingStatus: ContentItemPublishingStatus.UNPUBLISHED,
        body: {
          _meta: {},
          text: 'text 1'
        }
      });
      const notPublishedContentItemDependency = new ContentItem({
        id: 'da2ee918-34c3-4fc1-ae05-333333333333',
        label: 'Never been published - ignore me',
        publishingStatus: ContentItemPublishingStatus.NONE,
        body: {
          _meta: {},
          text: 'text 1'
        }
      });

      const mockGetHub = jest.fn();
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub.mockResolvedValue(new Hub({ id: HUB_ID }))
        }
      });
      (getContentByIds as unknown as jest.Mock).mockResolvedValue([
        publishedContentItem,
        unpublishedContentItemDependency,
        notPublishedContentItemDependency
      ]);

      mockUnpublish.mockImplementation((contentItem, fn) => {
        fn(new ContentItem({ id: '68e5289f0aba3024bde050f9' }));
      });

      await handler({
        ...globalArgs,
        id: [publishedContentItem.id, unpublishedContentItemDependency.id, notPublishedContentItemDependency.id],
        logFile: mockLog
      });

      expect(mockUnpublish).toHaveBeenCalledTimes(1);
      expect(mockUnpublish).toHaveBeenCalledWith(publishedContentItem, expect.any(Function));
      expect(mockUnpublishOnIdle).toHaveBeenCalledTimes(1);
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
      expect(mockUnpublish).toHaveBeenCalledTimes(0);
      expect(mockUnpublishOnIdle).toHaveBeenCalledTimes(0);
    });

    it('should exit early if ID or query args are not passed', async () => {
      await handler({
        ...globalArgs,
        id: CONTENT_ITEM_ID,
        facet: 'mock-facet',
        logFile: mockLog
      });
      expect(mockAppendLine).toHaveBeenCalledWith('Please specify either a facet or an ID - not both');
      expect(mockUnpublish).toHaveBeenCalledTimes(0);
      expect(mockUnpublishOnIdle).toHaveBeenCalledTimes(0);
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
      expect(mockAppendLine).toHaveBeenCalledWith('Nothing found to unpublish, aborting');
      expect(mockUnpublish).toHaveBeenCalledTimes(0);
      expect(mockUnpublishOnIdle).toHaveBeenCalledTimes(0);
    });
  });
});
