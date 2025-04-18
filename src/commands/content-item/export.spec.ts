import { builder, command, handler, LOG_FILENAME } from './export';
import { dependsOn } from './__mocks__/dependant-content-helper';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import Yargs from 'yargs/yargs';
import { ItemTemplate, getItemInfo, getItemName, MockContent } from '../../common/dc-management-sdk-js/mock-content';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { exists } from 'fs';
import { promisify } from 'util';
import readline from 'readline';

import rmdir from 'rimraf';
import { FileLog } from '../../common/file-log';

jest.mock('readline');
jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../common/log-helpers');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('content-item export command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function () {
    expect(command).toEqual('export <dir>');
  });

  it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function () {
    LOG_FILENAME();

    expect(getDefaultLogPath).toHaveBeenCalledWith('item', 'export', process.platform);
  });

  describe('builder tests', function () {
    it('should configure yargs', function () {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Output directory for the exported Content Items',
        type: 'string',
        requiresArg: true
      });

      expect(spyOption).toHaveBeenCalledWith('repoId', {
        type: 'string',
        describe:
          'Export content from within a given repository. Directory structure will start at the specified repository. Will automatically export all contained folders.'
      });

      expect(spyOption).toHaveBeenCalledWith('folderId', {
        type: 'string',
        describe:
          'Export content from within a given folder. Directory structure will start at the specified folder. Can be used in addition to repoId.'
      });

      expect(spyOption).toHaveBeenCalledWith('facet', {
        type: 'string',
        describe:
          "Export content matching the given facets. Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values. A regex can be provided for text filters, surrounded with forward slashes. For more examples, see the readme."
      });

      expect(spyOption).toHaveBeenCalledWith('publish', {
        type: 'boolean',
        boolean: true,
        describe: 'When available, export the last published version of a content item rather than its newest version.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: createLog
      });

      expect(spyOption).toHaveBeenCalledWith('name', {
        type: 'string',
        hidden: true
      });

      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        hidden: true
      });
    });
  });

  async function itemsExist(baseDir: string, items: ItemTemplate[], validRepos?: string[]): Promise<void> {
    const info = getItemInfo(items);
    for (let i = 0; i < items.length; i++) {
      const itemName = getItemName(baseDir, items[i], info, validRepos);
      const itemExists = await promisify(exists)(itemName);
      if (!itemExists) debugger;
      expect(itemExists).toBeTruthy();
    }
  }

  async function itemsDontExist(baseDir: string, items: ItemTemplate[], validRepos?: string[]): Promise<void> {
    const info = getItemInfo(items);
    for (let i = 0; i < items.length; i++) {
      const itemName = getItemName(baseDir, items[i], info, validRepos);
      const itemExists = await promisify(exists)(itemName);
      if (itemExists) debugger;
      expect(itemExists).toBeFalsy();
    }
  }

  describe('handler tests', function () {
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

    beforeAll(async () => {
      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/`);
    });

    it('should export all content when given only an output directory', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const templates: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo1', typeSchemaUri: 'http://type' },
        { label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
        { label: 'item4', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
      ];

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/all/`
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/all/`, templates);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/all/`);
    });

    it('should export content from a specific folder', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        { label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1' },
        { label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1/nested' }
      ];

      const skips: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo1', typeSchemaUri: 'http://type' },
        { label: 'item4', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder2' }
      ];

      const templates = skips.concat(exists);

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/folder1`,
        folderId: 'folder1'
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/`, exists);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/`, skips);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/folder1/`);
    });

    it('should export content from a multiple folders, with directory structure including both explicitly', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        { label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1' },
        { label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1/nested' },
        { label: 'item5', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder3' },
        { label: 'item6', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder3' }
      ];

      const skips: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo1', typeSchemaUri: 'http://type' },
        { label: 'item4', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder2' }
      ];

      const templates = skips.concat(exists);

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/multi/`,
        folderId: ['folder1', 'folder3']
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/multi/`, exists);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/multi/`, skips);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/multi/`);
    });

    it('should export content from a single repo, ignoring others', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        { label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1' },
        { label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1/nested' }
      ];

      const skips: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo2', typeSchemaUri: 'http://type' },
        { label: 'item4', repoId: 'repo2', typeSchemaUri: 'http://type', folderPath: 'folder2' },
        { label: 'item5', repoId: 'repo3', typeSchemaUri: 'http://type' }
      ];

      const templates = skips.concat(exists);

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/repo/`,
        repoId: 'repo1'
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/repo/`, exists);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/repo/`, skips);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/repo/`);
    });

    it('should export content from a multiple repos, ignoring others', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        { label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1' },
        { label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1/nested' },
        { label: 'item1', repoId: 'repo2', typeSchemaUri: 'http://type' },
        { label: 'item4', repoId: 'repo2', typeSchemaUri: 'http://type', folderPath: 'folder2' }
      ];

      const skips: ItemTemplate[] = [{ label: 'item5', repoId: 'repo3', typeSchemaUri: 'http://type' }];

      const templates = skips.concat(exists);

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/repomulti/`,
        repoId: ['repo1', 'repo2']
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/repomulti/`, exists, ['repo1', 'repo2']);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/repomulti/`, skips, ['repo1', 'repo2']);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/repomulti/`);
    });

    it('should only export content with a matching type id when specified', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        { label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://typeMatch', folderPath: 'folder1' },
        { label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://typeMatch', folderPath: 'folder1/nested' }
      ];

      const skips: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo1', typeSchemaUri: 'http://typeMatch' },
        { label: 'item4', repoId: 'repo1', typeSchemaUri: 'http://typeMatch', folderPath: 'folder2' },
        { label: 'item5', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1' }
      ];

      const templates = skips.concat(exists);

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/typeSpecific/folder1`,
        folderId: 'folder1',
        facet: 'schema:/typeMatch/'
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/typeSpecific/`, exists);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/typeSpecific/`, skips);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/typeSpecific/`);
    });

    it('should only export content with a matching name when specified', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        { label: 'item-nameMatch2', repoId: 'repo1', typeSchemaUri: 'http://type3', folderPath: 'folder1' },
        { label: 'item-nameMatch3', repoId: 'repo1', typeSchemaUri: 'http://type5', folderPath: 'folder1/nested' }
      ];

      const skips: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo1', typeSchemaUri: 'http://type2' },
        { label: 'item-nameMatch1', repoId: 'repo1', typeSchemaUri: 'http://type2' },
        { label: 'item4', repoId: 'repo1', typeSchemaUri: 'http://type4', folderPath: 'folder2' },
        { label: 'item-nameMatch4', repoId: 'repo1', typeSchemaUri: 'http://type4', folderPath: 'folder2' },
        { label: 'item5', repoId: 'repo1', typeSchemaUri: 'http://type1', folderPath: 'folder1' }
      ];

      const templates = skips.concat(exists);

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/nameSpecific/folder1`,
        folderId: 'folder1',
        facet: 'name:/nameMatch/'
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/nameSpecific/`, exists);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/nameSpecific/`, skips);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/nameSpecific/`);
    });

    it('should respect all filters when specified at the same time', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        // repo correct, label and type correct
        {
          label: 'item-nameMatch2',
          repoId: 'repo1',
          typeSchemaUri: 'http://typeMatch3',
          folderPath: 'folder1',
          id: '0'
        },
        {
          label: 'item-nameMatch3',
          repoId: 'repo1',
          typeSchemaUri: 'http://typeMatch5',
          folderPath: 'folder1/nested',
          id: '1'
        },

        {
          label: 'item-nameMatch7',
          repoId: 'repo2',
          typeSchemaUri: 'http://typeMatch7',
          folderPath: 'folder4',
          id: '2'
        },
        {
          label: 'item-nameMatch8',
          repoId: 'repo2',
          typeSchemaUri: 'http://typeMatch6',
          folderPath: 'folder4/nested',
          id: '3'
        }
      ];

      const skips: ItemTemplate[] = [
        // repo correct, type filtered out
        { label: 'item-nameMatch5', repoId: 'repo2', typeSchemaUri: 'http://type3', folderPath: 'folder3', id: '4' },

        // repo correct, name filtered out
        { label: 'item-name7', repoId: 'repo2', typeSchemaUri: 'http://typeMatch3', folderPath: 'folder3', id: '5' },
        {
          label: 'item-name8',
          repoId: 'repo2',
          typeSchemaUri: 'http://typeMatch5',
          folderPath: 'folder3/nested',
          id: '6'
        },

        // folder correct, type filtered out
        { label: 'item-nameMatch6', repoId: 'repo1', typeSchemaUri: 'http://type3', folderPath: 'folder1', id: '7' },

        // folder correct, name filtered out
        { label: 'item-name7', repoId: 'repo1', typeSchemaUri: 'http://typeMatch3', folderPath: 'folder1', id: '8' },
        {
          label: 'item-name8',
          repoId: 'repo1',
          typeSchemaUri: 'http://typeMatch5',
          folderPath: 'folder1/nested',
          id: '9'
        },

        // type and name correct/incorrect, repo and folder incorrect
        { label: 'item1', repoId: 'repo1', typeSchemaUri: 'http://type2', id: '10' },
        { label: 'item-nameMatch1', repoId: 'repo1', typeSchemaUri: 'http://typeMatch2', id: '11' },
        { label: 'item4', repoId: 'repo1', typeSchemaUri: 'http://type4', folderPath: 'folder2', id: '12' },
        {
          label: 'item-nameMatch4',
          repoId: 'repo1',
          typeSchemaUri: 'http://typeMatch4',
          folderPath: 'folder2',
          id: '13'
        },

        // folder correct, both filtered out
        { label: 'item5', repoId: 'repo1', typeSchemaUri: 'http://type1', folderPath: 'folder1', id: '14' }
      ];

      const templates = skips.concat(exists);

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/allFilter/`,
        repoId: 'repo2',
        folderId: 'folder1', // folder1 in addition to repo2
        facet: 'name:/nameMatch/,schema:/typeMatch/' // only content that with name containing nameMatch and type containing typeMatch
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/allFilter/`, exists, ['repo2']);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/allFilter/`, skips, ['repo2']);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/allFilter/`);
    });

    it('should export content outwith the filter if it is depended on', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        {
          label: 'item2',
          repoId: 'repo1',
          typeSchemaUri: 'http://typeD',
          folderPath: 'folder1',
          body: dependsOn(['item5', 'item7', 'itemMissing'])
        },
        { label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1/nested' },

        // These are in a different folder, but exported as dependancies.
        {
          id: 'item5',
          label: 'item5',
          repoId: 'repo1',
          typeSchemaUri: 'http://typeD',
          folderPath: 'folder2',
          body: dependsOn(['item6']),
          dependancy: 'folder1'
        },
        {
          id: 'item6',
          label: 'item6',
          repoId: 'repo1',
          typeSchemaUri: 'http://type',
          folderPath: 'folder2',
          body: dependsOn(['item5']),
          dependancy: 'folder1',
          status: 'ARCHIVED'
        },
        {
          id: 'item7',
          label: 'item7',
          repoId: 'repo1',
          typeSchemaUri: 'http://type',
          folderPath: 'folder2',
          dependancy: 'folder1'
        }
      ];

      const skips: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo1', typeSchemaUri: 'http://type' },
        { label: 'item4', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder2' }
      ];

      const templates = skips.concat(exists);

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/folder1`,
        folderId: 'folder1'
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/`, exists);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/`, skips);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/folder1/`);
    });

    it('should export archived content if it is depended on, from multiple repos', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        {
          id: 'item2',
          label: 'item2',
          repoId: 'repo1',
          typeSchemaUri: 'http://typeD',
          body: dependsOn(['item5', 'item7', 'itemMissing'])
        },

        {
          id: 'item8',
          label: 'item8',
          repoId: 'repo2',
          typeSchemaUri: 'http://typeD',
          body: dependsOn(['item9'])
        },

        // These are archived, but exported as dependancies.
        {
          id: 'item5',
          label: 'item5',
          repoId: 'repo1',
          typeSchemaUri: 'http://typeD',
          body: dependsOn(['item6']),
          dependancy: 'repo1',
          status: 'ARCHIVED'
        },
        {
          id: 'item6',
          label: 'item6',
          repoId: 'repo1',
          typeSchemaUri: 'http://type',
          body: dependsOn(['item5']),
          dependancy: 'repo1',
          status: 'ARCHIVED'
        },
        {
          id: 'item7',
          label: 'item7',
          repoId: 'repo1',
          typeSchemaUri: 'http://type',
          dependancy: 'repo1',
          status: 'ARCHIVED'
        },

        {
          id: 'item9',
          label: 'item9',
          repoId: 'repo2',
          typeSchemaUri: 'http://type',
          dependancy: 'repo2',
          status: 'ARCHIVED'
        }
      ];

      // Archived, but not as dependancies
      const skips: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo1', typeSchemaUri: 'http://type', status: 'ARCHIVED' },
        { label: 'item4', repoId: 'repo2', typeSchemaUri: 'http://type', folderPath: 'folder2', status: 'ARCHIVED' }
      ];

      const templates = skips.concat(exists);

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/repoDeps`
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/repoDeps/`, exists, ['repo1', 'repo2']);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/repoDeps/`, skips, ['repo1', 'repo2']);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/repoDeps/`);
    });

    it('should warn when schema validation fails, but not if it succeeds', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        { label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1' },
        {
          label: 'item3',
          repoId: 'repo1',
          typeSchemaUri: 'http://type',
          folderPath: 'folder1/nested',
          body: { valid: true }
        }
      ];

      const templates = exists;

      const content = new MockContent(dynamicContentClientFactory as jest.Mock);
      content.registerContentType('http://type', 'type', 'repo1', {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'http://superbasic.com',

        title: 'Title',
        description: 'Description',

        allOf: [
          {
            $ref: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content'
          }
        ],

        required: ['valid'],
        type: 'object',
        properties: {
          valid: {
            title: 'Valid',
            description: 'Content is only valid if it has this property.',
            type: 'boolean'
          }
        },
        propertyOrder: []
      });
      content.importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/validation/`,
        repoId: 'repo1'
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/validation/`, exists);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/validation/`);
    });

    it("should skip repositories if items can't be listed from them", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        { label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://type' },
        { label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://type' }
      ];

      const skips: ItemTemplate[] = [{ label: 'item1', repoId: 'repo2', typeSchemaUri: 'http://type' }];

      const templates = skips.concat(exists);

      const content = new MockContent(dynamicContentClientFactory as jest.Mock);
      content.importItemTemplates(templates);
      content.failRepoActions = 'list';

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/failRepo/`,
        repoId: 'repo1'
      };
      await handler(argv);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/failRepo/`, templates);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/failRepo/`);
    });

    it('should skip content items if they are fetched folder, but the content items endpoints fail', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        { label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1' },
        { label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder2' }
      ];

      const skips: ItemTemplate[] = [{ label: 'item1', repoId: 'repo2', typeSchemaUri: 'http://type' }];

      const templates = skips.concat(exists);

      const content = new MockContent(dynamicContentClientFactory as jest.Mock);
      content.importItemTemplates(templates);
      content.failRepoActions = 'list';
      content.failFolderActions = 'items';

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/failFolder/`,
        folderId: ['folder1', 'folder2']
      };
      await handler(argv);

      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/failFolder/`, templates);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/failFolder/`);
    });

    it('should place content items that error when getting the directory name in the base directory', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses([]);

      const exists: ItemTemplate[] = [
        { label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1/nested/nested2' },

        // This item does not need to search for a folder parent, as it is known as a base directory path.
        { label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder2' }
      ];

      const skips: ItemTemplate[] = [{ label: 'item1', repoId: 'repo2', typeSchemaUri: 'http://type' }];

      const templates = skips.concat(exists);

      const content = new MockContent(dynamicContentClientFactory as jest.Mock);
      content.importItemTemplates(templates);
      content.failFolderActions = 'parent';

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/failFolder/`,
        repoId: 'repo1'
      };
      await handler(argv);

      exists[0].folderPath = 'nested2'; // nested2 could not be tracked back to the base, so it was placed directly there.

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/failFolder/`, exists);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/failFolder/`, skips);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/failFolder/`);
    });

    it('should skip subfolders if the request for them fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses([]);

      const exists: ItemTemplate[] = [
        { label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1' }
      ];

      const skips: ItemTemplate[] = [
        // This item is in the subfolder, but it cannot be discovered
        { label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder1/nested' },
        { label: 'item1', repoId: 'repo2', typeSchemaUri: 'http://type' }
      ];

      const templates = skips.concat(exists);

      const content = new MockContent(dynamicContentClientFactory as jest.Mock);
      content.importItemTemplates(templates);
      content.failFolderActions = 'list';

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/failSubfolder/folder1`,
        folderId: 'folder1'
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/failSubfolder/`, exists);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/failSubfolder/`, skips);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/failSubfolder/`);
    });

    it('should fetch the last published version of content when available and --publish is passed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses([]);

      const templates: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo1', typeSchemaUri: 'http://type' },
        {
          label: 'item2',
          repoId: 'repo1',
          typeSchemaUri: 'http://type',
          folderPath: 'folderTest',
          lastPublishedVersion: 4,
          version: 5
        },
        {
          label: 'item3',
          repoId: 'repo1',
          typeSchemaUri: 'http://type',
          folderPath: 'folderTest',
          lastPublishedVersion: 5, // Version is the same, so does not need to be fetched.
          version: 5
        },
        {
          label: 'item4',
          repoId: 'repo1',
          typeSchemaUri: 'http://type',
          folderPath: 'folderTest/nested',
          lastPublishedVersion: 3,
          version: 5
        }
      ];

      const content = new MockContent(dynamicContentClientFactory as jest.Mock);
      content.importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/version/`,
        publish: true
      };
      await handler(argv);

      expect(content.metrics.itemsVersionGet).toEqual(2);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/version/`, templates);

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/version/`);
    });

    it('should populate exportedIds with the ids of exported content items when present', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        { id: 'id1', label: 'item2', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'exportedIds' },
        { id: 'id2', label: 'item3', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'exportedIds/nested' }
      ];

      const skips: ItemTemplate[] = [
        { label: 'item1', repoId: 'repo1', typeSchemaUri: 'http://type' },
        { label: 'item4', repoId: 'repo1', typeSchemaUri: 'http://type', folderPath: 'folder2' }
      ];

      const templates = skips.concat(exists);

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const exportedIds: string[] = [];

      const argv = {
        ...yargArgs,
        ...config,
        dir: `temp_${process.env.JEST_WORKER_ID}/export/exportedIds`,
        folderId: 'exportedIds',
        exportedIds
      };
      await handler(argv);

      await itemsExist(`temp_${process.env.JEST_WORKER_ID}/export/`, exists);
      await itemsDontExist(`temp_${process.env.JEST_WORKER_ID}/export/`, skips);

      expect(exportedIds).toEqual(exists.map(item => item.id as string));

      await rimraf(`temp_${process.env.JEST_WORKER_ID}/export/exportedIds/`);
    });
  });
});
