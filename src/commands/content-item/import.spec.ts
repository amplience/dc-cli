import { builder, command, handler } from './import';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Folder, ContentType } from 'dc-management-sdk-js';
import Yargs from 'yargs/yargs';
import { writeFile } from 'fs';
import { join, dirname, basename } from 'path';
import { promisify } from 'util';
import readline from 'readline';

import rmdir from 'rimraf';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { MockContent, ItemTemplate } from '../../common/dc-management-sdk-js/mock-content';

jest.mock('readline');
jest.mock('../../services/dynamic-content-client-factory');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('content-item import command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function() {
    expect(command).toEqual('import <dir>');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe:
          'Directory containing content items to import. If this points to an export manifest, we will try and import the content with the same absolute path and repositories as the export.',
        type: 'string',
        requiresArg: true
      });

      expect(spyOption).toHaveBeenCalledWith('baseRepo', {
        type: 'string',
        describe:
          'Import matching the given repository to the import base directory, by ID. Folder structure will be followed and replicated from there.'
      });

      expect(spyOption).toHaveBeenCalledWith('baseFolder', {
        type: 'string',
        describe:
          'Import matching the given folder to the import base directory, by ID. Folder structure will be followed and replicated from there.'
      });

      expect(spyOption).toHaveBeenCalledWith('mapFile', {
        type: 'string',
        describe:
          'Mapping file to use when updating content that already exists. Updated with any new mappings that are generated. If not present, will be created.'
      });

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe:
          'Overwrite content, create and assign content types, and ignore content with missing types/references without asking.'
      });

      expect(spyOption).toHaveBeenCalledWith('v', {
        type: 'boolean',
        boolean: true,
        describe: 'Only recreate folder structure - content is validated but not imported.'
      });
    });
  });

  describe('handler tests', function() {
    const yargArgs = {
      $0: 'test',
      _: ['test'],
      json: true
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    beforeAll(async () => {
      await rimraf('temp/import/');
    });

    afterAll(async () => {
      await rimraf('temp/import/');
    });

    async function createContent(
      baseFolder: string,
      items: ItemTemplate[],
      includeRepo: boolean,
      repoFolderBase?: string
    ): Promise<void> {
      await ensureDirectoryExists(baseFolder);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Create the items for import.
        const folderPath = item.folderPath || '';
        let folder = folderPath;
        if (repoFolderBase) {
          folder = folder.substring(repoFolderBase.length);
        }

        let path: string;
        if (includeRepo) {
          path = join(baseFolder, item.repoId, folder, `${item.label}.json`);
        } else {
          path = join(baseFolder, folder, `${item.label}.json`);
        }

        await ensureDirectoryExists(dirname(path));

        const folderId = folderPath == '' ? null : basename(folderPath as string);

        const content = {
          id: item.id,
          label: item.label,
          contentRepositoryId: item.repoId,
          folderId: folderId,
          body: {
            _meta: {
              schema: item.typeSchemaUri
            },
            ...(item.body || {})
          }
        };

        const jsonString = JSON.stringify(content);

        await promisify(writeFile)(path, jsonString);
      }
    }

    // == FUNCTIONALITY TESTS ==
    it('Importing into a baseRepo creates folder structure starting at the base repository', async () => {
      // Create content to import

      const templates: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item4', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
      ];

      await createContent('temp/import/repo/', templates, false);

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('targetRepo');
      mockContent.registerContentType('http://type', 'type', 'targetRepo');

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/import/repo/',
        mapFile: 'temp/import/repo.json',
        baseRepo: 'targetRepo'
      };
      await handler(argv);

      // check items were created appropriately

      const matches = await mockContent.filterMatch(templates, '', false);

      expect(matches.length).toEqual(templates.length);

      await rimraf('temp/import/repo/');
    });

    it('Importing into a baseFolder creates folder structure starting at the given folder (within the specified repository)', async () => {
      // Create content to import.

      const templates: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item4', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
      ];

      await createContent('temp/import/folder/', templates, false);

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('targetRepo');
      mockContent.createFolder(new Folder({ name: 'targetFolder', id: 'targetFolder', repoId: 'targetRepo' }));
      mockContent.registerContentType('http://type', 'type', 'targetRepo');

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/import/folder/',
        mapFile: 'temp/import/folder.json',
        baseFolder: 'targetFolder'
      };
      await handler(argv);

      // Check items were created appropriately.

      const matches = await mockContent.filterMatch(templates, 'targetFolder', false);

      expect(matches.length).toEqual(templates.length);

      await rimraf('temp/import/folder/');
    });

    it('Folder structure recreation should work with existing, matching folders present without creating more.', async () => {
      // Create content to import.

      const templates: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type2', folderPath: 'folderTest' },
        { label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item4exists', repoId: 'repo', typeSchemaUri: 'http://type2', folderPath: 'folderTest/exists' },
        { label: 'item5exists', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/exists/nested' },
        { label: 'item6doesnt', repoId: 'repo', typeSchemaUri: 'http://type2', folderPath: 'folderTest/doesnt' },
        { label: 'item7doesnt', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/doesnt/nested' }
      ];

      await createContent('temp/import/folder2/', templates, false);

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('targetRepo');

      const baseFolder = mockContent.createFolder(
        new Folder({ name: 'targetFolder', id: 'targetFolder', repoId: 'targetRepo' })
      );
      const folderTest = await baseFolder.related.folders.create(
        new Folder({ name: 'folderTest', id: 'folderTest', repoId: 'targetRepo' })
      );
      const exists = await folderTest.related.folders.create(
        new Folder({ name: 'exists', id: 'exists', repoId: 'targetRepo' })
      );
      await exists.related.folders.create(new Folder({ name: 'nested', id: 'nested', repoId: 'targetRepo' }));

      mockContent.registerContentType('http://type', 'type', 'targetRepo');
      mockContent.registerContentType('http://type2', 'type2', 'targetRepo');

      mockContent.metrics.reset();

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/import/folder2/',
        mapFile: 'temp/import/folder2.json',
        baseFolder: 'targetFolder'
      };
      await handler(argv);

      // Only created the two folders "folderTest/doesnt" and "folderTest/doesnt/nested".
      expect(mockContent.metrics.foldersCreated).toEqual(2);

      // Check items were created appropriately.
      const matches = await mockContent.filterMatch(templates, 'targetFolder', false);

      expect(matches.length).toEqual(templates.length);

      await rimraf('temp/import/folder2/');
    });

    // == INTERACTIVE PROMPT TESTS ==
    it('Importing with no base should map all folders in the import root to existing repositories, then recreate folder structures within them.', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      // Create content to import.

      const templates: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type2', folderPath: 'folderTest' },
        { label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item4', repoId: 'repo', typeSchemaUri: 'http://type2', folderPath: 'folderTest/nested' },

        { label: 'item1', repoId: 'repo2', typeSchemaUri: 'http://type' },
        { label: 'item2', repoId: 'repo2', typeSchemaUri: 'http://type2', folderPath: 'folderTest' },
        { label: 'item3', repoId: 'repo2', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item4', repoId: 'repo2', typeSchemaUri: 'http://type3', folderPath: 'folderTest/special' }
      ];

      await createContent('temp/import/all/', templates, true);

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('repo');
      mockContent.createMockRepository('repo2');

      mockContent.registerContentType('http://type', 'type', ['repo', 'repo2']);
      mockContent.registerContentType('http://type2', 'type2', ['repo', 'repo2']);
      mockContent.registerContentType('http://type3', 'type3', 'repo2');

      mockContent.metrics.reset();

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/import/all/',
        mapFile: 'temp/import/all.json'
      };
      await handler(argv);

      // Created a folder and a nested one in both repositories.
      expect(mockContent.metrics.foldersCreated).toEqual(4);

      // Check items were created appropriately.
      const matches = await mockContent.filterMatch(templates, '', true);

      expect(matches.length).toEqual(templates.length);

      await rimraf('temp/import/all/');
    });

    it('Importing content with no base and a missing repository name will request that it be skipped (then skip it)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      // Create content to import.

      const skipped: ItemTemplate[] = [
        // Repo 1 is missing, these should not be created.
        { label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type2', folderPath: 'folderTest' },
        { label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item4', repoId: 'repo', typeSchemaUri: 'http://type2', folderPath: 'folderTest/nested' }
      ];

      const added: ItemTemplate[] = [
        { label: 'item5', repoId: 'repo2', typeSchemaUri: 'http://type' },
        { label: 'item6', repoId: 'repo2', typeSchemaUri: 'http://type2', folderPath: 'folderTest' },
        { label: 'item7', repoId: 'repo2', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item8', repoId: 'repo2', typeSchemaUri: 'http://type3', folderPath: 'folderTest/special' }
      ];

      await createContent('temp/import/repoMissing/', skipped.concat(added), true);

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('repo2');

      mockContent.registerContentType('http://type', 'type', ['repo', 'repo2']);
      mockContent.registerContentType('http://type2', 'type2', ['repo', 'repo2']);
      mockContent.registerContentType('http://type3', 'type3', 'repo2');

      mockContent.metrics.reset();

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/import/repoMissing/',
        mapFile: 'temp/import/repoMissing.json'
      };
      await handler(argv);

      // Created a base folder and a nested one. One repository was skipped.
      expect(mockContent.metrics.foldersCreated).toEqual(2);

      // Check items were created appropriately.
      const matches = await mockContent.filterMatch(added, '', true);

      expect(matches.length).toEqual(added.length); // Only created the items that weren't skipped.

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(0); // All responses consumed.

      await rimraf('temp/import/repoMissing/');
    });

    it('Importing content with a missing content type (but not schema) will request that the content type be created (then create it)', async () => {
      // Asks if we want to create the types, then asks if we want to assign them.

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y', 'y']);

      // Create content to import

      const templates: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item4', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
      ];

      await createContent('temp/import/missingType/', templates, false);

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('targetRepo');
      mockContent.registerContentType('http://type', 'n/a', 'targetRepo', undefined, true);

      expect(mockContent.typeById.get('type')).toBeUndefined();

      mockContent.metrics.reset();

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/import/missingType/',
        mapFile: 'temp/import/missingType.json',
        baseRepo: 'targetRepo'
      };
      await handler(argv);

      // Check items were created appropriately.

      const matches = await mockContent.filterMatch(templates, '', false);

      // Type should be created.
      expect(mockContent.metrics.typesCreated).toEqual(1);
      expect((mockContent.typeById.values().next().value as ContentType).contentTypeUri).toEqual('http://type');

      expect(matches.length).toEqual(templates.length);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(0); // All responses consumed.

      await rimraf('temp/import/missingType/');
    });

    it('Importing content with a missing content type schema will ask if the affected content should be skipped (then create unaffected content)', async () => {
      // Asks if we want to skip the missing type schema.

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      // Create content to import

      const skipped: ItemTemplate[] = [
        // Repo 1 is missing, these should not be created.
        { label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item4', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
      ];

      const added: ItemTemplate[] = [
        { label: 'item5', repoId: 'repo', typeSchemaUri: 'http://type2' },
        { label: 'item6', repoId: 'repo', typeSchemaUri: 'http://type2', folderPath: 'folderTest' },
        { label: 'item7', repoId: 'repo', typeSchemaUri: 'http://type2', folderPath: 'folderTest' },
        { label: 'item8', repoId: 'repo', typeSchemaUri: 'http://type2', folderPath: 'folderTest/special' }
      ];

      await createContent('temp/import/missingSchema/', skipped.concat(added), false);

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('targetRepo');
      mockContent.registerContentType('http://type2', 'type2', 'targetRepo');

      expect(
        Array.from(mockContent.typeSchemaById.values()).find(schema => schema.id === 'http://type')
      ).toBeUndefined();
      expect(mockContent.typeById.get('type')).toBeUndefined();

      mockContent.metrics.reset();

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/import/missingSchema/',
        mapFile: 'temp/import/missingSchema.json',
        baseRepo: 'targetRepo'
      };
      await handler(argv);

      // Check items were created appropriately.

      const matches = await mockContent.filterMatch(added, '', false);

      expect(matches.length).toEqual(added.length);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(0); // All responses consumed.

      await rimraf('temp/import/missingSchema/');
    });

    function genContentTypeWithReference(
      typeName: string,
      refTypeName: string,
      ids: string[],
      isLink: boolean
    ): { type: object; body: object } {
      const type = {
        $schema: 'http://bigcontent.io/cms/schema/v1/schema#',
        id: typeName,

        title: 'Example content type',
        description: 'With a ref/link',

        allOf: [
          {
            $ref: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content'
          }
        ],

        propertyOrder: ['referenceList'],

        type: 'object',
        properties: {
          referenceList: {
            type: 'array',
            items: {
              allOf: [
                {
                  $ref: `http://bigcontent.io/cms/schema/v1/core#/definitions/content-${isLink ? 'link' : 'reference'}`
                },
                {
                  properties: {
                    contentType: {
                      title: 'Content Types',
                      enum: [refTypeName]
                    }
                  }
                }
              ]
            },
            title: 'Content Type',
            description: ''
          }
        }
      };

      const body = {
        referenceList: [
          ids.map(id => ({
            _meta: {
              schema: `http://bigcontent.io/cms/schema/v1/core#/definitions/content-${isLink ? 'link' : 'reference'}`
            },
            contentType: refTypeName,
            id: id
          }))
        ]
      };

      return { type, body };
    }

    it('Importing content with cross reference to a content item that exists only in the mapping should work without question', async () => {
      // Everything is in place - should not ask user any questions.

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses([]);

      // Create content to import

      const oldTemplates: ItemTemplate[] = [
        { id: 'new1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://refType' },
        { id: 'new2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://refType', folderPath: 'folderTest' }
      ];

      const item3 = genContentTypeWithReference('http://typeThatReferences', 'http://refType', ['ref1', 'ref2'], true);
      const item4 = genContentTypeWithReference('http://typeThatLinks', 'http://refType', ['ref2'], true);

      const templates: ItemTemplate[] = [
        {
          id: 'new3',
          label: 'item3',
          repoId: 'repo',
          typeSchemaUri: 'http://typeThatReferences',
          folderPath: 'folderTest',
          body: item3.body
        },
        {
          id: 'new4',
          label: 'item4',
          repoId: 'repo',
          typeSchemaUri: 'http://typeThatLinks',
          folderPath: 'folderTest/nested',
          body: item4.body
        },
        { id: 'new5', label: 'item5', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
      ];

      await createContent('temp/import/ref/', templates, false);

      // Add an existing mapping for the two items in "oldTemplates".
      const existingMapping = { contentItems: [['ref1', 'new1'], ['ref2', 'new2']] };
      await ensureDirectoryExists('temp/import/ref/');
      await rimraf('temp/import/ref.json');
      await promisify(writeFile)('temp/import/ref.json', JSON.stringify(existingMapping));

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('repo');
      mockContent.registerContentType('http://type', 'type', 'repo');
      mockContent.registerContentType('http://typeThatReferences', 'typeTRef', 'repo', item3.type);
      mockContent.registerContentType('http://typeThatLinks', 'typeTLink', 'repo', item4.type);
      mockContent.registerContentType('http://refType', 'refType', 'repo');
      mockContent.importItemTemplates(oldTemplates);

      mockContent.metrics.reset();

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/import/ref/',
        mapFile: 'temp/import/ref.json',
        baseRepo: 'repo'
      };
      await handler(argv);

      // Check items exist.

      const matches = await mockContent.filterMatch(templates.concat(oldTemplates), '', false);

      expect(matches.length).toEqual(5);

      // Make sure that only two were created

      expect(mockContent.metrics.itemsCreated).toEqual(3);
      expect(mockContent.metrics.itemsUpdated).toEqual(0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(0); // All responses consumed.

      await rimraf('temp/import/ref/');
    });

    it('Importing content with missing cross references should ask if the user wants to continue (and skip all dependant items)', async () => {
      // Everything is in place - should not ask user any questions.

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      // Create content to import

      const item3 = genContentTypeWithReference('http://typeThatReferences', 'http://refType', ['ref1', 'ref2'], true);
      const item4 = genContentTypeWithReference('http://typeThatLinks', 'http://refType', ['ref2'], true);

      const templates: ItemTemplate[] = [
        { id: 'new5', label: 'item5', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
      ];

      const skips: ItemTemplate[] = [
        {
          id: 'new3',
          label: 'item3',
          repoId: 'repo',
          typeSchemaUri: 'http://typeThatReferences',
          folderPath: 'folderTest',
          body: item3.body
        },
        {
          id: 'new4',
          label: 'item4',
          repoId: 'repo',
          typeSchemaUri: 'http://typeThatLinks',
          folderPath: 'folderTest/nested',
          body: item4.body
        }
      ];

      await createContent('temp/import/refMissing/', templates.concat(skips), false);

      // Add an existing mapping for the two items in "oldTemplates".
      await ensureDirectoryExists('temp/import/refMissing/');
      await rimraf('temp/import/refMissing.json');

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('repo');
      mockContent.registerContentType('http://type', 'type', 'repo');
      mockContent.registerContentType('http://typeThatReferences', 'typeTRef', 'repo', item3.type);
      mockContent.registerContentType('http://typeThatLinks', 'typeTLink', 'repo', item4.type);
      mockContent.registerContentType('http://refType', 'refType', 'repo');

      mockContent.metrics.reset();

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/import/refMissing/',
        mapFile: 'temp/import/refMissing.json',
        baseRepo: 'repo',
        skipIncomplete: true
      };
      await handler(argv);

      // Check items exist.

      const matches = await mockContent.filterMatch(templates, '', false);

      expect(matches.length).toEqual(1);

      // Make sure that only two were created

      expect(mockContent.metrics.itemsCreated).toEqual(1);
      expect(mockContent.metrics.itemsUpdated).toEqual(0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(0); // All responses consumed.

      await rimraf('temp/import/refMissing/');
    });

    it('Importing content with an existing mapping should ask if the user wants to overwrite existing content items (then overwrite it)', async () => {
      // Asks if we want to overwrite existing rather than skip.

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      // Create content to import

      const oldTemplates: ItemTemplate[] = [
        { id: 'old1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { id: 'old2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' }
      ];

      const newTemplates = oldTemplates.map(old => ({ ...old, id: 'new' + (old.id as string)[3] }));

      const templates: ItemTemplate[] = [
        { id: 'old3', label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { id: 'old4', label: 'item4', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
      ];

      oldTemplates.forEach(template => (template.label += 'updated')); // Should update existing content with this new label.

      await createContent('temp/import/mapping/', oldTemplates.concat(templates), false);

      // Add an existing mapping for the two items in "oldTemplates".
      const existingMapping = { contentItems: [['old1', 'new1'], ['old2', 'new2']] };
      await ensureDirectoryExists('temp/import/mapping/');
      await rimraf('temp/import/mapping.json');
      await promisify(writeFile)('temp/import/mapping.json', JSON.stringify(existingMapping));

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('repo');
      mockContent.registerContentType('http://type', 'type', 'repo');
      mockContent.importItemTemplates(newTemplates);

      mockContent.metrics.reset();

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/import/mapping/',
        mapFile: 'temp/import/mapping.json',
        baseRepo: 'repo'
      };
      await handler(argv);

      // Check items exist. They should have been updated too.

      newTemplates.forEach(template => (template.label += 'updated')); // Should update existing content with this new label.

      const matches = await mockContent.filterMatch(templates.concat(newTemplates), '', false);

      expect(matches.length).toEqual(4);

      // Make sure that only two were created

      expect(mockContent.metrics.itemsCreated).toEqual(2);
      expect(mockContent.metrics.itemsUpdated).toEqual(2);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(0); // All responses consumed.

      await rimraf('temp/import/mapping/');
    });

    it('Importing with the `force` flag should not ever await a response, and should skip and automate changes where necessary', async () => {
      // Everything ever should go wrong... but by forcing through it we will not be asked for anything.

      // - Overwrites based on existing mapping
      // - Automatically skips content with missing schema
      // - Automatically creates missing content types
      // - Automatically assigns content types
      // - Skips content from repositories that don't exist

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses([]);

      // Create content to import

      const oldTemplates: ItemTemplate[] = [
        { id: 'old1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
        { id: 'old2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' }
      ];

      const newTemplates = oldTemplates.map(old => ({ ...old, id: 'new' + (old.id as string)[3] }));

      const templates: ItemTemplate[] = [
        { id: 'old3', label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { id: 'old4', label: 'item4', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' },

        // Schema without type
        {
          id: 'type6',
          label: 'item6',
          repoId: 'repo',
          typeSchemaUri: 'http://typeCreate',
          folderPath: 'folderTest/nested'
        },

        // Schema+type that needs assignment
        {
          id: 'assign7',
          label: 'item7',
          repoId: 'repo',
          typeSchemaUri: 'http://typeAssign',
          folderPath: 'folderTest/nested'
        }
      ];

      const skips: ItemTemplate[] = [
        // Missing schema (to be skipped)
        {
          id: 'skip5',
          label: 'item5',
          repoId: 'repo',
          typeSchemaUri: 'http://typeMissing',
          folderPath: 'folderTest/nested'
        },

        // Missing repo (to be skipped)
        { id: 'skip8', label: 'item8', repoId: 'repoMissing', typeSchemaUri: 'http://type', folderPath: '' }
      ];

      oldTemplates.forEach(template => (template.label += 'updated')); // Should update existing content with this new label.

      await createContent('temp/import/force/', skips.concat(oldTemplates.concat(templates)), true);

      // Add an existing mapping for the two items in "oldTemplates".
      const existingMapping = { contentItems: [['old1', 'new1'], ['old2', 'new2']] };
      await ensureDirectoryExists('temp/import/force/');
      await rimraf('temp/import/force.json');
      await promisify(writeFile)('temp/import/force.json', JSON.stringify(existingMapping));

      const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('repo');
      mockContent.registerContentType('http://type', 'type', 'repo');
      mockContent.importItemTemplates(newTemplates);

      // Type must be created (and assigned)
      mockContent.registerContentType('http://typeCreate', 'typeCreate', [], undefined, true);

      // Type must be assigned
      mockContent.registerContentType('http://typeAssign', 'typeAssign', [], undefined, false);

      mockContent.metrics.reset();

      const argv = {
        ...yargArgs,
        ...config,
        force: true,
        dir: 'temp/import/force/',
        mapFile: 'temp/import/force.json'
      };
      await handler(argv);

      // Check items exist. They should have been updated too.

      newTemplates.forEach(template => (template.label += 'updated')); // Should update existing content with this new label.

      const matches = await mockContent.filterMatch(templates.concat(newTemplates), '', true);

      expect(matches.length).toEqual(6);

      // Make sure that only two were created

      expect(mockContent.metrics.itemsCreated).toEqual(4);
      expect(mockContent.metrics.itemsUpdated).toEqual(2);
      expect(mockContent.metrics.typesCreated).toEqual(1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((readline as any).responsesLeft()).toEqual(0); // All responses consumed.

      await rimraf('temp/import/force/');
    });
  });
});
