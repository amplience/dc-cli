import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentRepository, ContentType, ContentTypeCachedSchema, Hub } from 'dc-management-sdk-js';
import {
  builder,
  command,
  handler,
  storedContentTypeMapper,
  doCreate,
  doUpdate,
  processContentTypes,
  ContentTypeWithRepositoryAssignments,
  getContentRepositoryAssignments,
  UpdateStatus
} from './import';
import Yargs from 'yargs/yargs';
import { createStream } from 'table';
import * as importModule from './import';
import { loadJsonFromDirectory } from '../../services/import.service';
import paginator from '../../common/dc-management-sdk-js/paginator';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import chalk from 'chalk';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');
jest.mock('../../services/import.service');
jest.mock('../../common/dc-management-sdk-js/paginator');
jest.mock('fs');
jest.mock('table');

describe('content-type import command', (): void => {
  afterEach((): void => {
    jest.resetAllMocks();
  });

  it('should implement an import command', () => {
    expect(command).toEqual('import <dir>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Path to Content Type definitions',
        type: 'string'
      });
    });
  });

  describe('storedContentTypeMapper', () => {
    it('it should map to a stored content type', () => {
      const importedContentType = new ContentType({
        contentTypeUri: 'matched-uri',
        settings: { label: 'mutated-label' }
      });
      const storedContentType = [
        new ContentType({ id: 'stored-id', contentTypeUri: 'matched-uri', settings: { label: 'label' } })
      ];
      const result = storedContentTypeMapper(importedContentType, storedContentType);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'stored-id',
          contentTypeUri: 'matched-uri',
          settings: { label: 'mutated-label' }
        })
      );
    });

    it('should not map to a stored content type', () => {
      const importedContentType = new ContentType({
        contentTypeUri: 'not-matched-uri',
        settings: { label: 'mutated-label' }
      });
      const storedContentType = [
        new ContentType({ id: 'stored-id', contentTypeUri: 'matched-uri', settings: { label: 'label' } })
      ];
      const result = storedContentTypeMapper(importedContentType, storedContentType);

      expect(result).toEqual(
        expect.objectContaining({ contentTypeUri: 'not-matched-uri', settings: { label: 'mutated-label' } })
      );
    });
  });

  describe('doCreate', () => {
    it('should create a content type and return report', async () => {
      const mockHub = new Hub();
      const newContentType = new ContentType({ id: 'created-id' });
      const mockRegister = jest.fn().mockResolvedValue(newContentType);
      mockHub.related.contentTypes.register = mockRegister;
      const contentType = { contentTypeUri: 'content-type-uri', settings: { label: 'test-label' } };
      const result = await doCreate(mockHub, contentType as ContentType);

      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining(contentType));
      expect(result).toEqual(newContentType);
    });

    it('should throw an error when content type create fails', async () => {
      const mockHub = new Hub();
      const mockRegister = jest.fn().mockImplementation(() => {
        throw new Error('Error creating content type');
      });
      mockHub.related.contentTypes.register = mockRegister;
      const contentType = { contentTypeUri: 'content-type-uri', settings: { label: 'test-label' } };

      await expect(doCreate(mockHub, contentType as ContentType)).rejects.toThrowErrorMatchingSnapshot();
    });
  });

  describe('doUpdate', () => {
    const mockGet = jest.fn();
    let mockDynamicContentClientFactory: jest.Mock;

    beforeEach(() => {
      mockDynamicContentClientFactory = (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentTypes: {
          get: mockGet
        }
      });
    });
    it('should update a content type and return report', async () => {
      const mutatedContentType = {
        id: 'stored-id',
        contentTypeUri: 'not-matched-uri',
        settings: { label: 'mutated-label' }
      } as ContentType;
      const storedContentType = new ContentType({
        id: 'stored-id',
        contentTypeUri: 'matched-uri',
        settings: { label: 'label' }
      });
      mockGet.mockResolvedValue(storedContentType);

      const updatedContentType = new ContentType(mutatedContentType);
      const mockUpdate = jest.fn().mockResolvedValue(updatedContentType);
      storedContentType.related.update = mockUpdate;
      const mockContentTypeSchemaUpdate = jest.fn().mockResolvedValue(new ContentTypeCachedSchema());
      updatedContentType.related.contentTypeSchema.update = mockContentTypeSchemaUpdate;
      const client = mockDynamicContentClientFactory();
      const mutatedContentTypeWithRepoAssignments = {
        ...mutatedContentType,
        repositories: ['Slots']
      } as ContentTypeWithRepositoryAssignments;
      const result = await doUpdate(client, mutatedContentTypeWithRepoAssignments);

      expect(result).toEqual({ contentType: updatedContentType, updateStatus: UpdateStatus.UPDATED });
      expect(mockUpdate).toHaveBeenCalledWith(mutatedContentTypeWithRepoAssignments);
      expect(mockContentTypeSchemaUpdate).toHaveBeenCalledWith();
    });

    it('should skip update when no change to content-type and return report', async () => {
      const mutatedContentType = new ContentTypeWithRepositoryAssignments({
        id: 'stored-id',
        contentTypeUri: 'matched-uri',
        settings: { label: 'label' },
        repositories: ['Slots']
      });
      const storedContentType = new ContentType({
        id: 'stored-id',
        contentTypeUri: 'matched-uri',
        settings: { label: 'label' }
      });
      mockGet.mockResolvedValue(storedContentType);
      const client = mockDynamicContentClientFactory();
      const result = await doUpdate(client, mutatedContentType);

      expect(result).toEqual({ contentType: storedContentType, updateStatus: UpdateStatus.SKIPPED });
    });

    it('should throw an error when unable to get content type during update', async () => {
      const mutatedContentType = {
        id: 'stored-id',
        contentTypeUri: 'matched-uri',
        settings: { label: 'label' },
        repositories: ['Slots']
      } as ContentTypeWithRepositoryAssignments;
      mockGet.mockImplementation(() => {
        throw new Error('Error retrieving content type');
      });
      const client = mockDynamicContentClientFactory();

      await expect(doUpdate(client, mutatedContentType)).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should throw an error when unable to update content type during update', async () => {
      const mutatedContentType = new ContentTypeWithRepositoryAssignments({
        id: 'stored-id',
        contentTypeUri: 'not-matched-uri',
        settings: { label: 'mutated-label' }
      });
      const storedContentType = new ContentType({
        id: 'stored-id',
        contentTypeUri: 'matched-uri',
        settings: { label: 'label' }
      });
      const mockUpdate = jest.fn().mockRejectedValue(new Error('Error saving content type'));
      storedContentType.related.update = mockUpdate;
      mockGet.mockResolvedValue(storedContentType);
      const client = mockDynamicContentClientFactory();
      await expect(doUpdate(client, mutatedContentType)).rejects.toThrowErrorMatchingSnapshot();
      expect(mockUpdate).toHaveBeenCalledWith(mutatedContentType);
    });

    it("should throw an error when unable to update a content type's content type schema during update", async () => {
      const mutatedContentType = new ContentTypeWithRepositoryAssignments({
        id: 'stored-id',
        contentTypeUri: 'not-matched-uri',
        settings: { label: 'mutated-label' }
      });
      const storedContentType = new ContentType({
        id: 'stored-id',
        contentTypeUri: 'matched-uri',
        settings: { label: 'label' }
      });
      mockGet.mockResolvedValue(storedContentType);
      const updatedContentType = new ContentType(mutatedContentType);
      const mockUpdate = jest.fn().mockResolvedValue(updatedContentType);
      storedContentType.related.update = mockUpdate;
      const mockContentTypeSchemaUpdate = jest
        .fn()
        .mockRejectedValue(new Error('Unable to update content type schema'));
      updatedContentType.related.contentTypeSchema.update = mockContentTypeSchemaUpdate;
      const client = mockDynamicContentClientFactory();
      await expect(doUpdate(client, mutatedContentType)).rejects.toThrowErrorMatchingSnapshot();
      expect(mockUpdate).toHaveBeenCalledWith(mutatedContentType);
      expect(mockContentTypeSchemaUpdate).toHaveBeenCalledWith();
    });
  });

  describe('processContentTypes', () => {
    const mockStreamWrite = jest.fn();

    beforeEach(() => {
      (createStream as jest.Mock).mockReturnValue({
        write: mockStreamWrite
      });
    });

    it('should create and update a content type', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const hub = new Hub();
      const contentTypesToProcess = [
        { contentTypeUri: 'type-uri', settings: { label: 'created' } },
        { id: 'updated-id', contentTypeUri: 'type-uri', settings: { label: 'updated' }, repositories: ['Slots'] },
        { id: 'up-to-date-id', contentTypeUri: 'type-uri', settings: { label: 'up-to date' }, repositories: ['Slots'] }
      ] as ContentTypeWithRepositoryAssignments[];

      jest.spyOn(importModule, 'doCreate').mockResolvedValueOnce(new ContentType({ id: 'created-id' }));
      jest.spyOn(importModule, 'doUpdate').mockResolvedValueOnce({
        contentType: new ContentType({ id: 'updated-id' }),
        updateStatus: UpdateStatus.UPDATED
      });
      jest.spyOn(importModule, 'doUpdate').mockResolvedValueOnce({
        contentType: new ContentType({ id: 'up-to-date-id' }),
        updateStatus: UpdateStatus.SKIPPED
      });

      await processContentTypes(contentTypesToProcess, new Map<string, string[]>(), client, hub);

      expect(importModule.doCreate).toHaveBeenCalledWith(hub, contentTypesToProcess[0]);
      expect(importModule.doUpdate).toHaveBeenCalledWith(client, contentTypesToProcess[1]);
      expect(mockStreamWrite).toHaveBeenCalledTimes(4);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(1, [
        chalk.bold('id'),
        chalk.bold('contentTypeUri'),
        chalk.bold('result')
      ]);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(2, ['created-id', 'type-uri', 'CREATED']);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(3, ['updated-id', 'type-uri', 'UPDATED']);
      expect(mockStreamWrite).toHaveBeenNthCalledWith(4, ['up-to-date-id', 'type-uri', 'UP-TO DATE']);
    });
  });

  describe('getContentRepositoryAssignments', () => {
    it('should create a map of content repository names -> assigned content type ids', async () => {
      const hub = new Hub();

      const plainListContentRepository = [
        {
          id: '1',
          contentTypes: [
            {
              hubContentTypeId: 'id1',
              contentTypeUri: 'http://example.com/schema1.json'
            }
          ],
          features: [],
          itemLocales: ['en', 'fr'],
          label: 'Content',
          name: 'content-name',
          status: 'ACTIVE',
          type: 'CONTENT'
        },
        {
          id: '2',
          contentTypes: [
            {
              hubContentTypeId: 'id2',
              contentTypeUri: 'http://example.com/schema2.json'
            }
          ],
          features: ['slots'],
          itemLocales: ['en', 'fr'],
          label: 'Slots',
          name: 'slots-name',
          status: 'ACTIVE',
          type: 'SLOTS'
        }
      ];
      const listResponse = new MockPage(
        ContentRepository,
        plainListContentRepository.map(v => new ContentRepository(v))
      );
      const mockList = jest.fn().mockResolvedValue(listResponse);
      (paginator as jest.Mock).mockResolvedValue(plainListContentRepository);

      hub.related.contentRepositories.list = mockList;
      const assignments = await getContentRepositoryAssignments(hub);

      expect(paginator).toHaveBeenCalled();
      expect(assignments.size).toEqual(2);
      expect(assignments.has('slots-name')).toEqual(true);
      expect(assignments.get('slots-name')).toEqual(['id2']);
      expect(assignments.has('content-name')).toEqual(true);
      expect(assignments.get('content-name')).toEqual(['id1']);
    });
  });

  describe('synchroniseContentTypeRepositories', () => {});

  describe('handler tests', () => {
    const yargArgs = {
      $0: 'test',
      _: ['test']
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    const mockGetHub = jest.fn();

    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        hubs: {
          get: mockGetHub
        }
      });

      mockGetHub.mockResolvedValue({
        related: {
          contentTypes: {
            list: jest.fn()
          }
        }
      });
    });

    it('should create a content type and update a content type', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir' };
      const contentTypesToImport = [
        { contentTypeUri: 'type-uri', settings: { label: 'created' } },
        { id: 'content-type-id', contentTypeUri: 'type-uri', settings: { label: 'updated' }, repositories: ['Slots'] }
      ];

      (loadJsonFromDirectory as jest.Mock).mockReturnValue(contentTypesToImport);
      mockGetHub.mockResolvedValue(new Hub({ id: 'hub-id' }));
      (paginator as jest.Mock).mockResolvedValue([]);
      jest
        .spyOn(importModule, 'storedContentTypeMapper')
        .mockReturnValueOnce(contentTypesToImport[0] as ContentTypeWithRepositoryAssignments)
        .mockReturnValueOnce(contentTypesToImport[1] as ContentTypeWithRepositoryAssignments);
      jest.spyOn(importModule, 'processContentTypes').mockResolvedValueOnce();

      await handler(argv);

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('my-dir');
      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(paginator).toHaveBeenCalledWith(expect.any(Function));
      expect(processContentTypes).toHaveBeenCalledWith(
        contentTypesToImport,
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
});
