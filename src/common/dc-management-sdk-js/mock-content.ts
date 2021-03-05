/* eslint-disable @typescript-eslint/no-explicit-any */
import { join, basename, dirname } from 'path';
import {
  Folder,
  ContentItem,
  ContentRepository,
  Hub,
  DynamicContent,
  ContentType,
  ContentTypeSchema,
  ContentRepositoryContentType,
  Status,
  ContentTypeCachedSchema
} from 'dc-management-sdk-js';
import MockPage from './mock-page';
import { ResourceStatus, Status as TypeStatus } from './resource-status';

export interface ItemTemplate {
  label: string;
  id?: string;
  folderPath?: string;
  repoId: string;
  typeSchemaUri: string;
  version?: number;
  status?: string;
  locale?: string;
  lastPublishedVersion?: number;

  body?: any;
  dependancy?: string;
}

export interface ItemInfo {
  repos: string[];
  baseFolders: string[];
}

export interface MockRepository {
  repo: ContentRepository;
  items: ContentItem[];
  folders: Folder[];
}

export class MockContentMetrics {
  itemsCreated = 0;
  itemsUpdated = 0;
  itemsArchived = 0;
  itemsUnarchived = 0;
  itemsLocaleSet = 0;
  itemsVersionGet = 0;
  foldersCreated = 0;
  typesCreated = 0;
  typesArchived = 0;
  typesSynced = 0;
  typeSchemasCreated = 0;
  typeSchemasUpdated = 0;
  typeSchemasArchived = 0;

  reset(): void {
    this.itemsCreated = 0;
    this.itemsUpdated = 0;
    this.itemsArchived = 0;
    this.itemsUnarchived = 0;
    this.itemsLocaleSet = 0;
    this.itemsVersionGet = 0;
    this.foldersCreated = 0;
    this.typesCreated = 0;
    this.typesArchived = 0;
    this.typesSynced = 0;
    this.typeSchemasCreated = 0;
    this.typeSchemasUpdated = 0;
    this.typeSchemasArchived = 0;
  }
}

export class MockContent {
  items: ContentItem[] = [];
  repos: MockRepository[] = [];
  folders: Folder[] = [];

  typeById: Map<string, ContentType> = new Map();
  typeSchemaById: Map<string, ContentTypeSchema> = new Map();
  repoById: Map<string, MockRepository> = new Map();
  folderById: Map<string, Folder> = new Map();

  subfoldersById: Map<string, Folder[]> = new Map();
  typeAssignmentsByRepoId: Map<string, ContentType[]> = new Map();

  metrics = new MockContentMetrics();

  // If true, actions performed on content items will throw as if they failed.
  failItemActions: null | 'all' | 'not-version' = null;
  failFolderActions: null | 'list' | 'parent' | 'items' = null;
  failRepoActions: null | 'list' | 'create' = null;
  failTypeActions: null | 'all' = null;
  failSchemaActions: null | 'all' = null;
  failHubGet: boolean;
  failRepoList: boolean;

  uniqueId = 0;

  constructor(private contentService: jest.Mock<DynamicContent>) {
    const mockHub = this.createMockHub();

    const mockFolderGet = jest.fn(id => Promise.resolve(this.folderById.get(id) as Folder));
    const mockRepoGet = jest.fn(id => {
      return Promise.resolve((this.repoById.get(id) as MockRepository).repo);
    });

    const mockHubGet = jest.fn(() => {
      if (this.failHubGet) {
        throw new Error('Simulated Netowrk Failure.');
      }
      return Promise.resolve(mockHub);
    });

    const mockHubList = jest.fn().mockResolvedValue([mockHub]);

    const mockTypeGet = jest.fn(id => Promise.resolve(this.typeById.get(id) as ContentType));

    const mockTypeSchemaGet = jest.fn(id => Promise.resolve(this.typeSchemaById.get(id) as ContentTypeSchema));

    const mockTypeSchemaGetVersion = jest.fn((id, version) => {
      const schema = this.typeSchemaById.get(id) as ContentTypeSchema;

      schema.version = version;

      return Promise.resolve(schema);
    });

    const mockItemGet = jest.fn(id => {
      const result = this.items.find(item => item.id === id);
      if (result == null) {
        throw new Error(`Content item with id ${id} was requested, but is missing.`);
      }
      return Promise.resolve(result);
    });

    contentService.mockReturnValue(({
      hubs: {
        get: mockHubGet,
        list: mockHubList
      },
      folders: {
        get: mockFolderGet
      },
      contentRepositories: {
        get: mockRepoGet
      },
      contentTypes: {
        get: mockTypeGet
      },
      contentTypeSchemas: {
        get: mockTypeSchemaGet,
        getByVersion: mockTypeSchemaGetVersion
      },
      contentItems: {
        get: mockItemGet
      }
    } as any) as DynamicContent);
  }

  private getFolderName(path: string | undefined): string {
    let folderName = '';
    if (path != null) {
      const pathSplit = path.split('/');
      folderName = pathSplit[pathSplit.length - 1];
    }

    return folderName;
  }

  private createMockHub(): Hub {
    const mockHub = new Hub();

    const mockRepoList = jest.fn().mockImplementation(() => {
      if (this.failRepoList) {
        throw new Error('Simulated Netowrk Failure.');
      }
      return Promise.resolve(new MockPage(ContentRepository, this.repos.map(repo => repo.repo)));
    });
    const mockTypesList = jest
      .fn()
      .mockImplementation(() => Promise.resolve(new MockPage(ContentType, Array.from(this.typeById.values()))));
    const mockSchemaList = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new MockPage(ContentTypeSchema, Array.from(this.typeSchemaById.values())))
      );
    const mockTypeRegister = jest.fn().mockImplementation((type: ContentType) => {
      this.metrics.typesCreated++;
      type = new ContentType(type);
      type.id = 'UNIQUE-' + this.uniqueId++;
      this.typeById.set(type.id as string, type);
      return Promise.resolve(type);
    });

    mockHub.related.contentRepositories.list = mockRepoList;
    mockHub.related.contentTypeSchema.list = mockSchemaList;
    mockHub.related.contentTypes.list = mockTypesList;
    mockHub.related.contentTypes.register = mockTypeRegister;

    return mockHub;
  }

  private assignmentMeta(typeAssignments: ContentType[]): ContentRepositoryContentType[] {
    return typeAssignments.map(assign => ({
      hubContentTypeId: assign.id,
      contentTypeUri: assign.contentTypeUri
    }));
  }

  createMockRepository(repoId: string): void {
    if (this.repoById.has(repoId)) return;

    const repo = new ContentRepository({
      id: repoId,
      label: repoId
    });

    const mockRepo: MockRepository = {
      repo,
      folders: [],
      items: this.items.filter(item => (item as any).repoId == repoId)
    };

    const mockItemList = jest.fn().mockImplementation((options: any) => {
      if (this.failRepoActions == 'list') {
        throw new Error('Simulated network failure.');
      }

      let filter = mockRepo.items;
      if (options.status) {
        filter = filter.filter(item => item.status === options.status);
      }

      return Promise.resolve(new MockPage(ContentItem, filter));
    });
    repo.related.contentItems.list = mockItemList;

    const mockFolderList = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new MockPage(
            Folder,
            this.folders.filter(folder => (folder as any).repoId === repoId && folder.id == folder.name)
          )
        )
      );
    repo.related.folders.list = mockFolderList;

    const mockItemCreate = jest.fn().mockImplementation((item: ContentItem) => {
      if (this.failRepoActions == 'create') {
        throw new Error('Simulated network failure.');
      }

      item = new ContentItem(item);
      item.id = 'UNIQUE-' + this.uniqueId++;
      this.createItem(item, mockRepo);
      return Promise.resolve(item);
    });
    repo.related.contentItems.create = mockItemCreate;

    const mockTypeAssign = jest.fn().mockImplementation((contentTypeId: string) => {
      const typeAssignments = this.typeAssignmentsByRepoId.get(repo.id as string) || [];
      typeAssignments.push(this.typeById.get(contentTypeId) as ContentType);
      this.typeAssignmentsByRepoId.set(repo.id as string, typeAssignments);
      repo.contentTypes = this.assignmentMeta(typeAssignments);
      return Promise.resolve(repo);
    });
    repo.related.contentTypes.assign = mockTypeAssign;

    const mockFolderCreate = jest.fn().mockImplementation((folder: Folder) => {
      folder = new Folder(folder);
      (folder as any).repoId = repo.id;
      this.createFolder(folder);
      return Promise.resolve(folder);
    });
    repo.related.folders.create = mockFolderCreate;

    this.repoById.set(repoId, mockRepo);
    this.repos.push(mockRepo);
  }

  createItem(item: ContentItem, mockRepo: MockRepository | undefined): void {
    this.metrics.itemsCreated++;

    item.version = item.version || 1;
    item.locale = ''; // This is not created with the content.

    const mockItemRepo = jest.fn();
    item.related.contentRepository = mockItemRepo;

    const mockItemUpdate = jest.fn();
    item.related.update = mockItemUpdate;

    const mockItemArchive = jest.fn();
    item.related.archive = mockItemArchive;

    const mockItemUnarchive = jest.fn();
    item.related.unarchive = mockItemUnarchive;

    const mockItemVersion = jest.fn();
    item.related.contentItemVersion = mockItemVersion;

    const mockItemLocale = jest.fn(async (locale: string) => {
      this.metrics.itemsLocaleSet++;
      item.locale = locale;

      return Promise.resolve(item);
    });
    item.related.setLocale = mockItemLocale;

    if (mockRepo != null) {
      (item as any).repoId = mockRepo.repo.id;
    }

    mockItemRepo.mockImplementation(() => {
      if (this.failItemActions) throw new Error('Simulated network failure.');
      return Promise.resolve((this.repoById.get((item as any).repoId) as MockRepository).repo);
    });

    mockItemUpdate.mockImplementation(newItem => {
      if (this.failItemActions) throw new Error('Simulated network failure.');
      this.metrics.itemsUpdated++;

      item.label = newItem.label;
      item.body = newItem.body;
      item.status = newItem.status;
      item.version = (item.version as number) + 1;

      return Promise.resolve(item);
    });

    mockItemArchive.mockImplementation(() => {
      if (this.failItemActions) throw new Error('Simulated network failure.');
      if (item.status != Status.ACTIVE) {
        throw new Error('Cannot archive content that is already archived.');
      }

      this.metrics.itemsArchived++;

      item.status = Status.DELETED;

      return Promise.resolve(item);
    });

    mockItemUnarchive.mockImplementation(() => {
      if (this.failItemActions) throw new Error('Simulated network failure.');
      if (item.status == Status.ACTIVE) {
        throw new Error('Cannot unarchive content that is not archived.');
      }

      this.metrics.itemsUnarchived++;

      item.status = Status.ACTIVE;

      return Promise.resolve(item);
    });

    mockItemVersion.mockImplementation(version => {
      if (this.failItemActions && this.failItemActions != 'not-version') throw new Error('Simulated network failure.');
      const newItem = { ...item };

      newItem.version = version;
      this.metrics.itemsVersionGet++;

      return Promise.resolve(newItem);
    });

    this.items.push(item);

    if (mockRepo) {
      mockRepo.items.push(item);
    }
  }

  registerContentType(
    schemaName: string,
    id: string,
    repos: string | string[],
    body?: object,
    schemaOnly?: boolean
  ): void {
    if (!this.typeSchemaById.has(id)) {
      const schema = new ContentTypeSchema({
        id: id,
        schemaId: schemaName,
        body: JSON.stringify(body),
        status: 'ACTIVE'
      });
      this.typeSchemaById.set(id, schema);

      const mockSchemaArchive = jest.fn();
      schema.related.archive = mockSchemaArchive;

      const mockSchemaUpdate = jest.fn();
      schema.related.update = mockSchemaUpdate;

      mockSchemaArchive.mockImplementation(() => {
        if (this.failSchemaActions) throw new Error('Simulated network failure.');
        if ((schema as ResourceStatus).status != TypeStatus.ACTIVE) {
          throw new Error('Cannot archive content that is already archived.');
        }

        this.metrics.typeSchemasArchived++;

        (schema as ResourceStatus).status = TypeStatus.ARCHIVED;

        return Promise.resolve(schema);
      });

      mockSchemaUpdate.mockImplementation(newSchema => {
        if (this.failSchemaActions) throw new Error('Simulated network failure.');
        this.metrics.typeSchemasUpdated++;

        schema.body = newSchema.body;
        schema.version = (schema.version as number) + 1;

        return Promise.resolve(schema);
      });
    }

    if (!schemaOnly) {
      const type = new ContentType({
        id: id,
        contentTypeUri: schemaName,
        settings: { label: basename(schemaName) },
        status: 'ACTIVE'
      });
      this.typeById.set(id, type);

      const mockCached = jest.fn();
      type.related.contentTypeSchema.get = mockCached;

      const mockCachedUpdate = jest.fn();
      type.related.contentTypeSchema.update = mockCachedUpdate;

      const mockTypeArchive = jest.fn();
      type.related.archive = mockTypeArchive;

      mockCached.mockImplementation(() => {
        const cached = new ContentTypeCachedSchema({
          contentTypeUri: schemaName,
          cachedSchema: { ...body, $id: schemaName }
        });

        return Promise.resolve(cached);
      });

      mockCachedUpdate.mockImplementation(() => {
        const cached = new ContentTypeCachedSchema({
          contentTypeUri: schemaName,
          cachedSchema: { ...body, $id: schemaName }
        });

        this.metrics.typesSynced;

        return Promise.resolve(cached);
      });

      mockTypeArchive.mockImplementation(() => {
        if (this.failTypeActions) throw new Error('Simulated network failure.');
        if ((type as ResourceStatus).status != TypeStatus.ACTIVE) {
          throw new Error('Cannot archive content that is already archived.');
        }

        this.metrics.typesArchived++;

        (type as ResourceStatus).status = TypeStatus.ARCHIVED;

        return Promise.resolve(type);
      });

      const repoArray = typeof repos === 'string' ? [repos] : repos;
      repoArray.forEach(repoName => {
        const typeAssignments = this.typeAssignmentsByRepoId.get(repoName) || [];
        typeAssignments.push(type);
        const repo = this.repoById.get(repoName);
        if (repo != null) {
          repo.repo.contentTypes = this.assignmentMeta(typeAssignments);
        }
        this.typeAssignmentsByRepoId.set(repoName, typeAssignments);
      });
    }
  }

  importItemTemplates(templates: ItemTemplate[]): void {
    const repoIds: string[] = this.repos.map(repo => repo.repo.id as string);
    const newRepoIds: string[] = this.repos.map(repo => repo.repo.id as string);
    const folderTemplates: { name: string; id: string; repoId: string }[] = [];

    // Generate items.
    templates.forEach(template => {
      const folderId = template.folderPath;
      const folderName = this.getFolderName(folderId);

      const folderNullOrEmpty = folderId == null || folderId.length == 0;

      const item = new ContentItem({
        label: template.label,
        status: template.status || Status.ACTIVE,
        id: template.id || '0',
        folderId: folderNullOrEmpty ? null : folderId,
        version: template.version,
        lastPublishedVersion: template.lastPublishedVersion,
        locale: template.locale,
        body: {
          ...template.body,
          _meta: {
            schema: template.typeSchemaUri
          }
        },

        // Not meant to be here, but used later for sorting by repository
        repoId: template.repoId
      });

      if (repoIds.indexOf(template.repoId) === -1) {
        repoIds.push(template.repoId);
        newRepoIds.push(template.repoId);
      }

      if (!folderNullOrEmpty && folderTemplates.findIndex(folder => folder.id == folderId) === -1) {
        folderTemplates.push({ id: folderId || '', name: folderName, repoId: template.repoId });
      }

      this.createItem(item, this.repoById.get(template.repoId));
    });

    const generateFolder = (folderTemplate: { name: string; id: string; repoId: string }): void => {
      if (this.folderById.has(folderTemplate.id)) {
        return;
      }

      const id = folderTemplate.id;

      const folder = new Folder({
        id: id,
        name: folderTemplate.name,
        repoId: folderTemplate.repoId
      });

      const slashInd = id.lastIndexOf('/');
      if (slashInd !== -1) {
        const parentPath = id.substring(0, slashInd);
        let parent = this.folders.find(folder => folder.id == parentPath);
        if (parentPath != '') {
          generateFolder({ id: parentPath, name: this.getFolderName(parentPath), repoId: folderTemplate.repoId });
          parent = this.folders.find(folder => folder.id == parentPath);
        }
        if (parent != null) {
          const subfolders = this.subfoldersById.get(parent.id as string) || [];
          subfolders.push(folder);
          this.subfoldersById.set(parent.id as string, subfolders);
        }
      }

      this.createFolder(folder);
    };

    // Generate folders that contain the items.
    folderTemplates.forEach(folderTemplate => {
      generateFolder(folderTemplate);
    });

    // Generate repositories.
    newRepoIds.forEach(repoId => {
      this.createMockRepository(repoId);
    });
  }

  private async getFolderPath(folder: Folder | undefined): Promise<string> {
    if (folder == null) {
      return '';
    }

    let parent: Folder | undefined = undefined;
    try {
      parent = await folder.related.folders.parent();
    } catch {}

    if (parent == null) {
      return (folder.name as string) + '/';
    } else {
      return (await this.getFolderPath(parent)) + (folder.name as string) + '/';
    }
  }

  private async getPath(item: ContentItem): Promise<string> {
    return (await this.getFolderPath(this.folderById.get(item.folderId as string))) + item.label + '.json';
  }

  async filterMatch(templates: ItemTemplate[], baseDir: string, multiRepo: boolean): Promise<ItemTemplate[]> {
    const results: ItemTemplate[] = [];

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      for (let j = 0; j < this.items.length; j++) {
        const item = this.items[j];

        if (item.label === template.label) {
          if (multiRepo) {
            const repo = await item.related.contentRepository();
            if (repo.id != template.repoId) {
              continue;
            }
          }
          const path = await this.getPath(item);
          if (join(baseDir, template.folderPath || '') == dirname(path)) {
            results.push(template);
          }
          break;
        }
      }
    }

    return results;
  }

  createFolder(folder: Folder): Folder {
    this.metrics.foldersCreated++;

    const id = folder.id as string;

    const mockFolderList = jest.fn();
    folder.related.contentItems.list = mockFolderList;
    const mockFolderSubfolder = jest.fn();
    folder.related.folders.list = mockFolderSubfolder;
    const mockFolderParent = jest.fn();
    folder.related.folders.parent = mockFolderParent;
    const mockFolderCreate = jest.fn();
    folder.related.folders.create = mockFolderCreate;
    const mockFolderRepo = jest.fn();
    folder.related.contentRepository = mockFolderRepo;

    mockFolderList.mockImplementation(() => {
      if (this.failFolderActions === 'items') {
        throw new Error('Simulated network failure.');
      }
      return Promise.resolve(new MockPage(ContentItem, this.items.filter(item => item.folderId === id)));
    });

    mockFolderSubfolder.mockImplementation(() => {
      if (this.failFolderActions === 'list') {
        throw new Error('Simulated network failure.');
      }
      const subfolders: Folder[] = this.subfoldersById.get(id) || [];
      return Promise.resolve(new MockPage(Folder, subfolders));
    });

    mockFolderParent.mockImplementation(() => {
      if (this.failFolderActions === 'parent') {
        throw new Error('Simulated network failure.');
      }
      let result: Folder | undefined;
      this.subfoldersById.forEach((value, key) => {
        if (value.indexOf(folder) !== -1) {
          result = this.folderById.get(key);
        }
      });
      if (result == null) {
        throw new Error('No parent - calling this throws an exception.');
      }
      return Promise.resolve(result);
    });

    mockFolderCreate.mockImplementation((newFolder: Folder) => {
      const subfolders = this.subfoldersById.get(id) || [];
      newFolder.id = 'UNIQUE-' + this.uniqueId++;

      subfolders.push(newFolder);
      (newFolder as any).repoId = (folder as any).repoId;
      this.createFolder(newFolder);
      this.subfoldersById.set(id, subfolders);
      return Promise.resolve(newFolder);
    });

    mockFolderRepo.mockImplementation(() =>
      Promise.resolve((this.repoById.get((folder as any).repoId) as MockRepository).repo)
    );

    this.folderById.set(id, folder);
    this.folders.push(folder);

    return folder;
  }
}

export function getItemInfo(items: ItemTemplate[]): ItemInfo {
  const repos: string[] = [];
  const baseFolders: string[] = [];

  items.forEach(item => {
    if (repos.indexOf(item.repoId) === -1) {
      repos.push(item.repoId);
    }

    if (item.folderPath != null) {
      const folderFirstSlash = item.folderPath.indexOf('/');
      const baseFolder = folderFirstSlash === -1 ? item.folderPath : item.folderPath.substring(0, folderFirstSlash);

      if (baseFolder.length > 0 && baseFolders.indexOf(baseFolder) === -1) {
        baseFolders.push(baseFolder);
      }
    }
  });

  return { repos, baseFolders };
}

export function getItemName(baseDir: string, item: ItemTemplate, info: ItemInfo, validRepos?: string[]): string {
  if (item.dependancy) {
    return join(baseDir, item.dependancy, '_dependancies', item.label + '.json');
  }

  if (validRepos) {
    let basePath = item.folderPath || '';
    if (info.repos.length > 1 && validRepos.indexOf(item.repoId) !== -1) {
      basePath = `${item.repoId}/${basePath}`;
    }
    return join(baseDir + basePath, item.label + '.json');
  } else {
    return join(baseDir + (item.folderPath || ''), item.label + '.json');
  }
}
