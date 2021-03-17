import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentRepository, ContentType, ContentTypeCachedSchema, Hub } from 'dc-management-sdk-js';
import * as importModule from './import';
import {
  builder,
  command,
  ContentTypeWithRepositoryAssignments,
  doCreate,
  doUpdate,
  doSync,
  handler,
  MappedContentRepositories,
  processContentTypes,
  storedContentTypeMapper,
  synchronizeContentTypeRepositories,
  validateNoDuplicateContentTypeUris,
  LOG_FILENAME
} from './import';
import Yargs from 'yargs/yargs';
import { table } from 'table';
import { streamTableOptions } from '../../common/table/table.consts';
import { loadJsonFromDirectory, UpdateStatus } from '../../services/import.service';
import paginator from '../../common/dc-management-sdk-js/paginator';
import chalk from 'chalk';
import { FileLog } from '../../common/file-log';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');
jest.mock('../../services/import.service');
jest.mock('../../common/dc-management-sdk-js/paginator');
jest.mock('fs');
jest.mock('table');

describe('content-type import command', (): void => {
  /**
   * Helper method to create a content repositories map from a list
   *
   * @param contentRepositories ContentRepository[]
   * @return Map<string, ContentRepository>
   */
  const createContentRepositoriesMap = (contentRepositories: ContentRepository[]): MappedContentRepositories =>
    new Map<string, ContentRepository>(contentRepositories.map(value => [value.name || '', value]));

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should implement an import command', () => {
    expect(command).toEqual('import <dir>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Path to Content Type definitions',
        type: 'string'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.'
      });
    });
  });

  describe('storedContentTypeMapper', () => {
    it('it should map to a stored content type', () => {
      const importedContentType = new ContentTypeWithRepositoryAssignments({
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
      const importedContentType = new ContentTypeWithRepositoryAssignments({
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
      const log = new FileLog();
      const newContentType = new ContentType({ id: 'created-id' });
      const mockRegister = jest.fn().mockResolvedValue(newContentType);
      mockHub.related.contentTypes.register = mockRegister;
      const contentType = { contentTypeUri: 'content-type-uri', settings: { label: 'test-label' } };
      const result = await doCreate(mockHub, contentType as ContentType, log);

      expect(log.getData('CREATE')).toMatchInlineSnapshot(`
        Array [
          "created-id",
        ]
      `);
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining(contentType));
      expect(result).toEqual(newContentType);
    });

    it('should throw an error when content type create fails', async () => {
      const mockHub = new Hub();
      const log = new FileLog();
      const mockRegister = jest.fn().mockImplementation(() => {
        throw new Error('Error creating content type');
      });
      mockHub.related.contentTypes.register = mockRegister;
      const contentType = { contentTypeUri: 'content-type-uri', settings: { label: 'test-label' } };

      await expect(doCreate(mockHub, contentType as ContentType, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('UPDATE')).toEqual([]);
    });

    it('should throw an error when content type create fails if a string error is returned by the sdk', async () => {
      const mockHub = new Hub();
      const log = new FileLog();
      const mockRegister = jest
        .fn()
        .mockRejectedValue(
          'The register-content-type action is not available, ensure you have permission to perform this action.'
        );
      mockHub.related.contentTypes.register = mockRegister;
      const contentType = { contentTypeUri: 'content-type-uri', settings: { label: 'test-label' } };

      await expect(doCreate(mockHub, contentType as ContentType, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('UPDATE')).toEqual([]);
    });
  });

  describe('doSync', () => {
    const mockGet = jest.fn();
    let mockDynamicContentClientFactory: jest.Mock;

    beforeEach(() => {
      mockDynamicContentClientFactory = (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentTypes: {
          get: mockGet
        }
      });
    });

    it("should throw an error when unable to update a content type's content type schema during update", async () => {
      const client = mockDynamicContentClientFactory();
      const contentType = new ContentTypeWithRepositoryAssignments({
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

      const mockContentTypeSchemaUpdate = jest
        .fn()
        .mockRejectedValue(new Error('Unable to update content type schema'));
      storedContentType.related.contentTypeSchema.update = mockContentTypeSchemaUpdate;

      await expect(doSync(client, contentType)).rejects.toThrowErrorMatchingSnapshot();
      expect(mockContentTypeSchemaUpdate).toHaveBeenCalledWith();
    });

    it('should update a content type and return report', async () => {
      const client = mockDynamicContentClientFactory();
      const mutatedContentType = {
        id: 'stored-id',
        contentTypeUri: 'not-matched-uri',
        settings: { label: 'mutated-label' }
      } as ContentType;
      const storedContentType = new ContentType({
        id: 'stored-id',
        contentTypeUri: 'matched-uri',
        settings: {
          label: 'label',
          visualizations: [
            {
              label: 'Localhost',
              templatedUri: 'http://localhost:3000/visualization.html?vse={{vse.domain}}&content={{content.sys.id}}',
              default: true
            }
          ]
        }
      });
      mockGet.mockResolvedValue(storedContentType);

      const mockContentTypeSchemaUpdate = jest.fn().mockResolvedValue(new ContentTypeCachedSchema());
      storedContentType.related.contentTypeSchema.update = mockContentTypeSchemaUpdate;
      const result = await doSync(client, {
        ...mutatedContentType,
        repositories: ['Slots']
      } as ContentTypeWithRepositoryAssignments);

      expect(result).toEqual({ contentType: storedContentType, updateStatus: UpdateStatus.UPDATED });
      expect(mockContentTypeSchemaUpdate).toHaveBeenCalledWith();
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
        settings: {
          label: 'label',
          visualizations: [
            {
              label: 'Localhost',
              templatedUri: 'http://localhost:3000/visualization.html?vse={{vse.domain}}&content={{content.sys.id}}',
              default: true
            }
          ]
        }
      });
      const expectedContentType = new ContentType({
        id: 'stored-id',
        contentTypeUri: 'not-matched-uri',
        settings: {
          label: 'mutated-label',
          visualizations: [
            {
              label: 'Localhost',
              templatedUri: 'http://localhost:3000/visualization.html?vse={{vse.domain}}&content={{content.sys.id}}',
              default: true
            }
          ]
        }
      });
      mockGet.mockResolvedValue(storedContentType);

      const updatedContentType = new ContentType(mutatedContentType);
      const mockUpdate = jest.fn().mockResolvedValue(updatedContentType);
      storedContentType.related.update = mockUpdate;
      const mockContentTypeSchemaUpdate = jest.fn().mockResolvedValue(new ContentTypeCachedSchema());
      updatedContentType.related.contentTypeSchema.update = mockContentTypeSchemaUpdate;
      const client = mockDynamicContentClientFactory();
      const log = new FileLog();
      const result = await doUpdate(
        client,
        {
          ...mutatedContentType,
          repositories: ['Slots']
        } as ContentTypeWithRepositoryAssignments,
        log
      );

      expect(log.getData('UPDATE')).toMatchInlineSnapshot(`
        Array [
          "stored-id",
        ]
      `);
      expect(result).toEqual({ contentType: updatedContentType, updateStatus: UpdateStatus.UPDATED });
      expect(mockUpdate).toHaveBeenCalledWith({
        ...expectedContentType.toJSON(),
        repositories: ['Slots']
      } as ContentTypeWithRepositoryAssignments);
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
      const log = new FileLog();
      const result = await doUpdate(client, mutatedContentType, log);

      expect(result).toEqual({ contentType: storedContentType, updateStatus: UpdateStatus.SKIPPED });
      expect(log.getData('UPDATE')).toEqual([]);
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
      const log = new FileLog();

      await expect(doUpdate(client, mutatedContentType, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('UPDATE')).toEqual([]);
    });

    it('should throw an error when unable to update content type during update if a string error is returned by sdk', async () => {
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
      const mockUpdate = jest
        .fn()
        .mockRejectedValue('The update action is not available, ensure you have permission to perform this action.');
      storedContentType.related.update = mockUpdate;
      mockGet.mockResolvedValue(storedContentType);
      const client = mockDynamicContentClientFactory();
      const log = new FileLog();
      await expect(doUpdate(client, mutatedContentType, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('UPDATE')).toEqual([]);
      expect(mockUpdate).toHaveBeenCalledWith(mutatedContentType);
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
      const log = new FileLog();
      await expect(doUpdate(client, mutatedContentType, log)).rejects.toThrowErrorMatchingSnapshot();
      expect(log.getData('UPDATE')).toEqual([]);
      expect(mockUpdate).toHaveBeenCalledWith(mutatedContentType);
    });
  });

  describe('processContentTypes', () => {
    let mockTable: jest.Mock;

    beforeEach(() => {
      mockTable = table as jest.Mock;
      mockTable.mockImplementation(jest.requireActual('table').table);
    });

    it('should create and update a content type', async () => {
      const client = (dynamicContentClientFactory as jest.Mock)();
      const hub = new Hub();
      const contentTypesToProcess = [
        new ContentTypeWithRepositoryAssignments({
          contentTypeUri: 'type-uri',
          settings: { label: 'created' },
          repositories: ['Slots']
        }),
        new ContentTypeWithRepositoryAssignments({
          id: 'updated-id',
          contentTypeUri: 'type-uri-2',
          settings: { label: 'updated' },
          repositories: ['Slots']
        }),
        new ContentTypeWithRepositoryAssignments({
          id: 'up-to-date-id',
          contentTypeUri: 'type-uri-3',
          settings: { label: 'up-to date' },
          repositories: ['Slots']
        })
      ];

      const contentRepositories = [new ContentRepository({ id: 'repo-id', name: 'repo-name' })];
      (paginator as jest.Mock).mockResolvedValue(contentRepositories);
      jest
        .spyOn(importModule, 'synchronizeContentTypeRepositories')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const createdContentType = new ContentType({
        id: 'created-id',
        ...contentTypesToProcess[0].toJSON()
      });
      jest.spyOn(importModule, 'doCreate').mockResolvedValueOnce(createdContentType);
      const doUpdateResult1 = {
        contentType: contentTypesToProcess[1],
        updateStatus: UpdateStatus.UPDATED
      };
      jest.spyOn(importModule, 'doUpdate').mockResolvedValueOnce(doUpdateResult1);
      const doUpdateResult2 = {
        contentType: contentTypesToProcess[2],
        updateStatus: UpdateStatus.SKIPPED
      };
      jest.spyOn(importModule, 'doUpdate').mockResolvedValueOnce(doUpdateResult2);

      await processContentTypes(contentTypesToProcess, client, hub, false, new FileLog());

      expect(paginator).toHaveBeenCalledTimes(1);
      expect(importModule.doCreate).toHaveBeenCalledWith(hub, contentTypesToProcess[0], expect.any(FileLog));
      expect(importModule.doUpdate).toHaveBeenCalledWith(client, contentTypesToProcess[1], expect.any(FileLog));
      expect(importModule.synchronizeContentTypeRepositories).toHaveBeenCalledTimes(3);
      const mappedReposByName = createContentRepositoriesMap(contentRepositories);
      expect(importModule.synchronizeContentTypeRepositories).toHaveBeenCalledTimes(3);

      expect(importModule.synchronizeContentTypeRepositories).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          ...createdContentType.toJSON(),
          repositories: ['Slots']
        }),
        mappedReposByName
      );
      expect(importModule.synchronizeContentTypeRepositories).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ ...contentTypesToProcess[1].toJSON(), repositories: ['Slots'] }),
        mappedReposByName
      );
      expect(importModule.synchronizeContentTypeRepositories).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ ...contentTypesToProcess[2].toJSON(), repositories: ['Slots'] }),
        mappedReposByName
      );
      expect(mockTable).toHaveBeenCalledTimes(1);
      expect(mockTable).toHaveBeenNthCalledWith(
        1,
        [
          [chalk.bold('ID'), chalk.bold('Schema ID'), chalk.bold('Result')],
          [createdContentType.id, createdContentType.contentTypeUri, 'CREATED'],
          [doUpdateResult1.contentType.id, doUpdateResult1.contentType.contentTypeUri, 'UPDATED'],
          [doUpdateResult2.contentType.id, doUpdateResult2.contentType.contentTypeUri, 'UP-TO-DATE']
        ],
        streamTableOptions
      );
    });
  });

  describe('synchronizeContentTypeRepositories', () => {
    const mockGet = jest.fn();

    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentRepositories: {
          get: mockGet
        }
      });
    });

    it('should throw an error when the repositories field is not an array', async () => {
      await expect(
        synchronizeContentTypeRepositories(
          new ContentTypeWithRepositoryAssignments({
            id: 'id',
            contentTypeUri: 'http://example.com/content-type.json',
            repositories: ''
          }),
          new Map([])
        )
      ).rejects.toThrowError(
        new Error('Invalid format supplied for repositories. Please provide an array of repository names')
      );
    });

    it('should throw an error when the repositories field is an array, but one of the values is not a string', async () => {
      await expect(
        synchronizeContentTypeRepositories(
          new ContentTypeWithRepositoryAssignments({
            id: 'id',
            contentTypeUri: 'http://example.com/content-type.json',
            repositories: ['repo1', 'repo2', {}, 'repo3']
          }),
          new Map([])
        )
      ).rejects.toThrowError(
        new Error('Invalid format supplied for repositories. Please provide an array of repository names')
      );
    });

    it('should do nothing if no repositories are specified or assigned', async () => {
      await synchronizeContentTypeRepositories(
        new ContentTypeWithRepositoryAssignments({
          id: 'id',
          contentTypeUri: 'http://example.com/content-type.json',
          repositories: []
        }),
        new Map([])
      );
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('should do nothing if content type doesnt have any repositories and all of the repositories assigned to other content types', async () => {
      const result = await synchronizeContentTypeRepositories(
        new ContentTypeWithRepositoryAssignments({
          id: 'id',
          contentTypeUri: 'http://example.com/content-type.json',
          repositories: []
        }),
        createContentRepositoriesMap([
          new ContentRepository({
            id: 'repo-id1',
            name: 'repo-name1',
            contentTypes: [
              {
                hubContentTypeId: 'content-type-a',
                contentTypeUri: 'http://example.com/content-type-a.json'
              },
              {
                hubContentTypeId: 'content-type-b',
                contentTypeUri: 'http://example.com/content-type-b.json'
              }
            ]
          }),
          new ContentRepository({
            id: 'repo-id2',
            name: 'repo-name2',
            contentTypes: [
              {
                hubContentTypeId: 'content-type-a',
                contentTypeUri: 'http://example.com/content-type-a.json'
              },
              {
                hubContentTypeId: 'content-type-b',
                contentTypeUri: 'http://example.com/content-type-b.json'
              }
            ]
          })
        ])
      );
      expect(result).toEqual(false);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('should assign content type to a repository if not already assigned', async () => {
      const contentType = new ContentTypeWithRepositoryAssignments({
        id: 'id',
        contentTypeUri: 'http://example.com/content-type.json',
        repositories: ['repo-name']
      });

      const contentRepository = new ContentRepository({
        id: 'repo-id',
        name: 'repo-name',
        contentTypes: []
      });
      contentRepository.related.contentTypes.assign = jest.fn().mockResolvedValue(contentRepository);

      const result = await synchronizeContentTypeRepositories(
        contentType,
        createContentRepositoriesMap([contentRepository])
      );
      expect(result).toEqual(true);
      expect(contentRepository.related.contentTypes.assign).toHaveBeenCalledWith(contentType.id);
    });

    it('should ignore content repositories that do not have a name value', async () => {
      const contentType = new ContentTypeWithRepositoryAssignments({
        id: 'id',
        contentTypeUri: 'http://example.com/content-type.json',
        repositories: ['repo-name']
      });

      const contentRepository1 = new ContentRepository({
        id: 'repo-id',
        name: 'repo-name',
        contentTypes: []
      });
      contentRepository1.related.contentTypes.assign = jest.fn().mockResolvedValue(contentRepository1);

      const contentRepository2 = new ContentRepository({
        id: 'repo-id',
        name: undefined, // should never happen
        contentTypes: []
      });
      contentRepository2.related.contentTypes.assign = jest.fn().mockResolvedValue(contentRepository2);

      const result = await synchronizeContentTypeRepositories(
        contentType,
        createContentRepositoriesMap([contentRepository1, contentRepository2])
      );
      expect(result).toEqual(true);
      expect(contentRepository1.related.contentTypes.assign).toHaveBeenCalledWith(contentType.id);
      expect(contentRepository2.related.contentTypes.assign).not.toHaveBeenCalled();
    });

    it('should assign content type to a repository if not already assigned (duplicate repository)', async () => {
      const contentType = new ContentTypeWithRepositoryAssignments({
        id: 'id',
        contentTypeUri: 'http://example.com/content-type.json',
        repositories: ['repo-name', 'repo-name']
      });

      const contentRepository = new ContentRepository({
        id: 'repo-id',
        name: 'repo-name',
        contentTypes: []
      });
      contentRepository.related.contentTypes.assign = jest.fn().mockResolvedValue(contentRepository);

      const result = await synchronizeContentTypeRepositories(
        contentType,
        createContentRepositoriesMap([contentRepository])
      );
      expect(result).toEqual(true);
      expect(contentRepository.related.contentTypes.assign).toHaveBeenCalledTimes(1);
      expect(contentRepository.related.contentTypes.assign).toHaveBeenCalledWith(contentType.id);
    });

    it('should throw an error if content type has an unknown repository', async () => {
      const contentType = new ContentTypeWithRepositoryAssignments({
        id: 'id',
        contentTypeUri: 'http://example.com/content-type.json',
        repositories: ['not-found']
      });

      const contentRepository = new ContentRepository({
        id: 'repo-id',
        name: 'repo-name',
        contentTypes: []
      });

      await expect(
        synchronizeContentTypeRepositories(contentType, createContentRepositoriesMap([contentRepository]))
      ).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should not assign content type to a repository if its already assigned', async () => {
      const contentType = new ContentTypeWithRepositoryAssignments({
        id: 'id',
        contentTypeUri: 'http://example.com/content-type.json',
        repositories: ['repo-name']
      });

      const contentRepository = new ContentRepository({
        id: 'repo-id',
        name: 'repo-name',
        contentTypes: [
          {
            hubContentTypeId: contentType.id,
            contentTypeUri: contentType.contentTypeUri
          }
        ]
      });
      contentRepository.related.contentTypes.assign = jest.fn().mockResolvedValue(contentRepository);

      const result = await synchronizeContentTypeRepositories(
        contentType,
        createContentRepositoriesMap([contentRepository])
      );
      expect(result).toEqual(false);
      expect(contentRepository.related.contentTypes.assign).not.toHaveBeenCalled();
    });

    it('should assign content type to multiple repositories, where not already assigned', async () => {
      const contentType = new ContentTypeWithRepositoryAssignments({
        id: 'id',
        contentTypeUri: 'http://example.com/content-type.json',
        repositories: ['repo-name1', 'repo-name2']
      });

      const contentRepository1 = new ContentRepository({
        id: 'repo-id1',
        name: 'repo-name1',
        contentTypes: [
          {
            hubContentTypeId: contentType.id,
            contentTypeUri: contentType.contentTypeUri
          }
        ]
      });
      contentRepository1.related.contentTypes.assign = jest.fn();

      const contentRepository2 = new ContentRepository({
        id: 'repo-id2',
        name: 'repo-name2',
        contentTypes: []
      });
      contentRepository2.related.contentTypes.assign = jest.fn();

      const contentRepository3 = new ContentRepository({
        id: 'repo-id3',
        name: 'repo-name3',
        contentTypes: [
          {
            hubContentTypeId: contentType.id,
            contentTypeUri: contentType.contentTypeUri
          }
        ]
      });
      contentRepository3.related.contentTypes.unassign = jest.fn();

      const result = await synchronizeContentTypeRepositories(
        contentType,
        createContentRepositoriesMap([contentRepository1, contentRepository2, contentRepository3])
      );

      expect(result).toEqual(true);
      expect(contentRepository1.related.contentTypes.assign).not.toHaveBeenCalled();
      expect(contentRepository2.related.contentTypes.assign).toHaveBeenCalledWith(contentType.id);
      expect(contentRepository3.related.contentTypes.unassign).toHaveBeenCalledWith(contentType.id);
    });

    it('should unassign a content type from a repository that has been omitted from the supplied list', async () => {
      const contentType = new ContentTypeWithRepositoryAssignments({
        id: 'id',
        contentTypeUri: 'http://example.com/content-type.json',
        repositories: []
      });

      const contentRepository = new ContentRepository({
        id: 'repo-id',
        name: 'repo-name',
        contentTypes: [
          {
            hubContentTypeId: contentType.id,
            contentTypeUri: contentType.contentTypeUri
          }
        ]
      });

      contentRepository.related.contentTypes.unassign = jest.fn().mockResolvedValue(contentRepository);

      const result = await synchronizeContentTypeRepositories(
        contentType,
        createContentRepositoriesMap([contentRepository])
      );

      expect(result).toEqual(true);
      expect(contentRepository.related.contentTypes.unassign).toHaveBeenCalledWith(contentType.id);
    });
  });

  describe('validateNoDuplicateContentTypeUris', function() {
    it('should not throw an error when there are no duplicates', () => {
      const contentTypesToProcess = {
        'file-1': new ContentTypeWithRepositoryAssignments({
          contentTypeUri: 'type-uri-1'
        }),
        'file-2': new ContentTypeWithRepositoryAssignments({
          contentTypeUri: 'type-uri-2'
        })
      };

      expect(() => validateNoDuplicateContentTypeUris(contentTypesToProcess)).not.toThrow();
    });

    it('should throw and error when there are duplicate uris', () => {
      const contentTypesToProcess = {
        'file-1': new ContentTypeWithRepositoryAssignments({
          contentTypeUri: 'type-uri-1'
        }),
        'file-2': new ContentTypeWithRepositoryAssignments({
          contentTypeUri: 'type-uri-2'
        }),
        'file-3': new ContentTypeWithRepositoryAssignments({
          contentTypeUri: 'type-uri-2'
        }),
        'file-4': new ContentTypeWithRepositoryAssignments({
          contentTypeUri: 'type-uri-1'
        })
      };

      expect(() => validateNoDuplicateContentTypeUris(contentTypesToProcess)).toThrowErrorMatchingSnapshot();
    });
  });

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

    it('should create a content type and update', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', sync: false };
      const fileNamesAndContentTypesToImport = {
        'file-1': new ContentTypeWithRepositoryAssignments({
          contentTypeUri: 'type-uri-1',
          settings: {
            label: 'created'
          }
        }),
        'file-2': new ContentTypeWithRepositoryAssignments({
          id: 'content-type-id',
          contentTypeUri: 'type-uri-2',
          settings: { label: 'updated' },
          repositories: ['Slots']
        })
      };

      (loadJsonFromDirectory as jest.Mock).mockReturnValue(fileNamesAndContentTypesToImport);
      mockGetHub.mockResolvedValue(new Hub({ id: 'hub-id' }));
      jest
        .spyOn(importModule, 'storedContentTypeMapper')
        .mockReturnValueOnce(fileNamesAndContentTypesToImport['file-1'])
        .mockReturnValueOnce(fileNamesAndContentTypesToImport['file-2']);
      jest.spyOn(importModule, 'processContentTypes').mockResolvedValueOnce();

      await handler(argv);

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('my-dir', ContentTypeWithRepositoryAssignments);
      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(processContentTypes).toHaveBeenCalledWith(
        Object.values(fileNamesAndContentTypesToImport),
        expect.any(Object),
        expect.any(Object),
        false,
        expect.any(Object)
      );
    });

    it('should create a content type, update and sync a content type', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-dir', sync: true };
      const fileNamesAndContentTypesToImport = {
        'file-1': new ContentTypeWithRepositoryAssignments({
          contentTypeUri: 'type-uri-1',
          settings: {
            label: 'created'
          }
        }),
        'file-2': new ContentTypeWithRepositoryAssignments({
          id: 'content-type-id',
          contentTypeUri: 'type-uri-2',
          settings: { label: 'updated' },
          repositories: ['Slots']
        })
      };

      (loadJsonFromDirectory as jest.Mock).mockReturnValue(fileNamesAndContentTypesToImport);
      mockGetHub.mockResolvedValue(new Hub({ id: 'hub-id' }));
      jest
        .spyOn(importModule, 'storedContentTypeMapper')
        .mockReturnValueOnce(fileNamesAndContentTypesToImport['file-1'])
        .mockReturnValueOnce(fileNamesAndContentTypesToImport['file-2']);
      jest.spyOn(importModule, 'processContentTypes').mockResolvedValueOnce();

      await handler(argv);

      expect(loadJsonFromDirectory).toHaveBeenCalledWith('my-dir', ContentTypeWithRepositoryAssignments);
      expect(mockGetHub).toHaveBeenCalledWith('hub-id');
      expect(processContentTypes).toHaveBeenCalledWith(
        Object.values(fileNamesAndContentTypesToImport),
        expect.any(Object),
        expect.any(Object),
        true,
        expect.any(Object)
      );
    });

    it('should throw an error when no content found in import directory', async (): Promise<void> => {
      const argv = { ...yargArgs, ...config, dir: 'my-empty-dir', sync: false };

      (loadJsonFromDirectory as jest.Mock).mockReturnValue([]);

      await expect(handler(argv)).rejects.toThrowErrorMatchingSnapshot();
    });
  });
});
