import { builder, handler, getContentItems, processItems, LOG_FILENAME, coerceLog } from './publish';
import { Status, ContentItem, DynamicContent, Hub } from 'dc-management-sdk-js';
import { FileLog } from '../../common/file-log';
import * as publish from '../../common/import/publish-queue';
import { Arguments } from 'yargs';
import { ConfigurationParameters } from '../configure';
import PublishOptions from '../../common/publish/publish-options';
import Yargs from 'yargs/yargs';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../common/content-item/confirm-all-content');
jest.mock('../../common/log-helpers');
jest.mock('../../common/filter/fetch-content');
jest.mock('../../common/import/publish-queue');

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

const argv: Arguments<ConfigurationParameters> = {
  $0: '',
  _: [],
  clientId: 'client-id',
  clientSecret: 'client-secret',
  hubId: 'hub-id',
  batchPublish: false
} as Arguments<ConfigurationParameters>;

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

      expect(spyOption).toHaveBeenCalledWith('batchPublish', {
        type: 'boolean',
        boolean: true,
        describe: 'Batch publish requests up to the rate limit. (35/min)'
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
    beforeEach(() => jest.clearAllMocks());

    it('should exit early if no content items', async () => {
      console.log = jest.fn();

      await processItems({
        contentItems: [],
        logFile: mockLog,
        allContent: false,
        missingContent: false,
        argv
      });

      expect(console.log).toHaveBeenCalledWith('Nothing found to publish, aborting.');
    });

    it('should confirm before publishing when force is false', async () => {
      const confirmAllContent = require('../../common/content-item/confirm-all-content').confirmAllContent;
      confirmAllContent.mockResolvedValue(false);
      console.log = jest.fn();

      await processItems({
        contentItems: [{ id: '1', label: 'Test' } as ContentItem],
        force: false,
        silent: true,
        logFile: mockLog,
        allContent: false,
        missingContent: false,
        argv
      });

      expect(confirmAllContent).toHaveBeenCalled();
    });

    it('should process all items and call publish', async () => {
      const contentItem = { id: '1', label: 'Publish Me' } as ContentItem;

      await processItems({
        contentItems: [contentItem],
        force: true,
        silent: true,
        logFile: mockLog,
        allContent: false,
        missingContent: false,
        argv
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((publish as any).publishCalls.length).toEqual(1);
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
