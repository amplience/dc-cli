import { builder, handler, getContentItems, processItems, LOG_FILENAME, coerceLog } from './publish';
import { Status, ContentItem, DynamicContent, Hub, PublishingJob } from 'dc-management-sdk-js';
import { FileLog } from '../../common/file-log';
import { Arguments } from 'yargs';
import { ConfigurationParameters } from '../configure';
import PublishOptions from '../../common/publish/publish-options';
import Yargs from 'yargs/yargs';
import readline from 'readline';
import { PublishingJobStatus } from 'dc-management-sdk-js/build/main/lib/model/PublishingJobStatus';

const mockPublish = jest.fn().mockImplementation((contentItems, fn) => {
  fn(contentItems);
});
const mockCheck = jest.fn().mockImplementation((publishingJob, fn) => {
  fn(new PublishingJob({ state: PublishingJobStatus.COMPLETED }));
});

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../common/content-item/confirm-all-content');
jest.mock('../../common/log-helpers');
jest.mock('../../common/filter/fetch-content');
jest.mock('readline');
jest.mock('../../common/publishing/content-item-publishing-service', () => {
  return {
    ContentItemPublishingService: jest.fn().mockImplementation(() => {
      return {
        publish: mockPublish,
        onIdle: jest.fn()
      };
    })
  };
});
jest.mock('../../common/publishing/content-item-publishing-job-service', () => {
  return {
    ContentItemPublishingJobService: jest.fn().mockImplementation(() => {
      return {
        check: mockCheck,
        onIdle: jest.fn()
      };
    })
  };
});

const mockClient = {
  contentItems: {
    get: jest.fn()
  },
  hubs: {
    get: jest.fn()
  }
} as unknown as DynamicContent;

const mockLog = {
  open: jest.fn().mockReturnValue({
    appendLine: jest.fn(),
    close: jest.fn()
  })
} as unknown as FileLog;

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

  describe('getContentItems tests', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should return content items by id', async () => {
      const mockItem = { id: '1', status: Status.ACTIVE } as ContentItem;
      mockClient.contentItems.get = jest.fn().mockResolvedValue(mockItem);

      const result = await getContentItems({
        client: mockClient,
        id: '1',
        hubId: 'hub-id'
      });

      expect(result.contentItems).toEqual([mockItem]);
      expect(result.missingContent).toBe(false);
    });

    it('should filter out non-active content items', async () => {
      mockClient.contentItems.get = jest
        .fn()
        .mockResolvedValueOnce({ id: '1', status: Status.ARCHIVED })
        .mockResolvedValueOnce({ id: '2', status: Status.ACTIVE });

      const result = await getContentItems({
        client: mockClient,
        id: ['1', '2'],
        hubId: 'hub-id'
      });

      expect(result.contentItems).toHaveLength(1);
      expect(result.contentItems[0].id).toBe('2');
      expect(result.missingContent).toBe(true);
    });

    it('should return content using fallback filters', async () => {
      const mockHub = {} as Hub;
      const contentItems = [{ id: 'a', status: Status.ACTIVE }] as ContentItem[];
      const getContent = require('../../common/filter/fetch-content').getContent;
      mockClient.hubs.get = jest.fn().mockResolvedValue(mockHub);
      getContent.mockResolvedValue(contentItems);

      const result = await getContentItems({
        client: mockClient,
        hubId: 'hub-id',
        facet: 'label:test'
      });

      expect(result.contentItems).toEqual(contentItems);
    });
  });

  describe('processItems tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.mock('readline');
    });

    it('should exit early if no content items', async () => {
      console.log = jest.fn();

      await processItems({
        contentItems: [],
        logFile: mockLog,
        allContent: false,
        missingContent: false,
        client: mockClient
      });

      expect(console.log).toHaveBeenCalledWith('Nothing found to publish, aborting.');
    });

    it('should confirm before publishing when force is false', async () => {
      const confirmAllContent = require('../../common/content-item/confirm-all-content').confirmAllContent;
      confirmAllContent.mockResolvedValue(false);
      console.log = jest.fn();

      await processItems({
        contentItems: [new ContentItem({ id: '1', label: 'Test', body: { _meta: {} } })],
        force: false,
        silent: true,
        logFile: mockLog,
        allContent: false,
        missingContent: false,
        client: mockClient
      });

      expect(confirmAllContent).toHaveBeenCalled();
    });

    it('should process all items and call publish', async () => {
      const contentItem = new ContentItem({ id: '1', label: 'Publish Me', body: { _meta: {} } });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['Y']);

      await processItems({
        contentItems: [contentItem],
        force: true,
        silent: true,
        logFile: mockLog,
        allContent: false,
        missingContent: false,
        client: mockClient
      });

      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockCheck).toHaveBeenCalledTimes(1);
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['Y']);

      await processItems({
        contentItems: [contentItemWithDependency, contentItemDependency],
        force: true,
        silent: true,
        logFile: mockLog,
        allContent: false,
        missingContent: false,
        client: mockClient
      });

      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockCheck).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler tests', () => {
    const clientFactory = require('../../services/dynamic-content-client-factory').default;
    const getItemsSpy = jest.spyOn(require('./publish'), 'getContentItems');
    const processSpy = jest.spyOn(require('./publish'), 'processItems');
    beforeEach(() => {
      jest.clearAllMocks();
      clientFactory.mockReturnValue(mockClient);
      getItemsSpy.mockResolvedValue({
        contentItems: [{ id: '123', label: 'Test', status: Status.ACTIVE }],
        missingContent: false
      });
      processSpy.mockResolvedValue(undefined);
    });
    it('should warn when both id and facet are provided', async () => {
      console.log = jest.fn();
      await handler({
        id: '1',
        facet: 'label:test',
        hubId: 'hub-id',
        logFile: mockLog
      } as Arguments<PublishOptions & ConfigurationParameters>);
      expect(console.log).toHaveBeenCalledWith('Please specify either a facet or an ID - not both.');
    });
    it('should process items with valid inputs', async () => {
      await handler({
        hubId: 'hub-id',
        logFile: mockLog
      } as Arguments<PublishOptions & ConfigurationParameters>);
      expect(getItemsSpy).toHaveBeenCalled();
      expect(processSpy).toHaveBeenCalled();
    });
  });
});
