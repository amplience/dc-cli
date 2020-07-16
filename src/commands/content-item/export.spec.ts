import { builder, command, handler, LOG_FILENAME } from './export';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import Yargs from 'yargs/yargs';
import { ItemTemplate, getItemInfo, getItemName, MockContent } from '../../common/dc-management-sdk-js/mock-content';
import { exists } from 'fs';
import { promisify } from 'util';
import readline from 'readline';

import rmdir from 'rimraf';

jest.mock('readline');
jest.mock('../../services/dynamic-content-client-factory');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('content-item export command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function() {
    expect(command).toEqual('export <dir>');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
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

      expect(spyOption).toHaveBeenCalledWith('schemaId', {
        type: 'string',
        describe:
          'Export content with a given or matching Schema ID. A regex can be provided, surrounded with forward slashes. Can be used in combination with other filters.'
      });

      expect(spyOption).toHaveBeenCalledWith('name', {
        type: 'string',
        describe:
          'Export content with a given or matching Name. A regex can be provided, surrounded with forward slashes. Can be used in combination with other filters.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.'
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
      await rimraf('temp/export/');
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
        dir: 'temp/export/all/'
      };
      await handler(argv);

      await itemsExist('temp/export/all/', templates);

      await rimraf('temp/export/all/');
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
        dir: 'temp/export/folder1',
        folderId: 'folder1'
      };
      await handler(argv);

      await itemsExist('temp/export/', exists);
      await itemsDontExist('temp/export/', skips);

      await rimraf('temp/export/folder1/');
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
        dir: 'temp/export/multi/',
        folderId: ['folder1', 'folder3']
      };
      await handler(argv);

      await itemsExist('temp/export/multi/', exists);
      await itemsDontExist('temp/export/multi/', skips);

      await rimraf('temp/export/multi/');
    });

    it('should export content from a single repo, ignoring others.', async () => {
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
        dir: 'temp/export/repo/',
        repoId: 'repo1'
      };
      await handler(argv);

      await itemsExist('temp/export/repo/', exists);
      await itemsDontExist('temp/export/repo/', skips);

      await rimraf('temp/export/repo/');
    });

    it('should export content from a multiple repos, ignoring others.', async () => {
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
        dir: 'temp/export/repomulti/',
        repoId: ['repo1', 'repo2']
      };
      await handler(argv);

      await itemsExist('temp/export/repomulti/', exists, ['repo1', 'repo2']);
      await itemsDontExist('temp/export/repomulti/', skips, ['repo1', 'repo2']);

      await rimraf('temp/export/repomulti/');
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
        dir: 'temp/export/typeSpecific/folder1',
        folderId: 'folder1',
        schemaId: '/typeMatch/'
      };
      await handler(argv);

      await itemsExist('temp/export/typeSpecific/', exists);
      await itemsDontExist('temp/export/typeSpecific/', skips);

      await rimraf('temp/export/typeSpecific/');
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
        dir: 'temp/export/nameSpecific/folder1',
        folderId: 'folder1',
        name: '/nameMatch/'
      };
      await handler(argv);

      await itemsExist('temp/export/nameSpecific/', exists);
      await itemsDontExist('temp/export/nameSpecific/', skips);

      await rimraf('temp/export/nameSpecific/');
    });

    it('should respect all filters when specified at the same time', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const exists: ItemTemplate[] = [
        // repo correct, label and type correct
        { label: 'item-nameMatch2', repoId: 'repo1', typeSchemaUri: 'http://typeMatch3', folderPath: 'folder1' },
        { label: 'item-nameMatch3', repoId: 'repo1', typeSchemaUri: 'http://typeMatch5', folderPath: 'folder1/nested' },

        { label: 'item-nameMatch7', repoId: 'repo2', typeSchemaUri: 'http://typeMatch7', folderPath: 'folder4' },
        { label: 'item-nameMatch8', repoId: 'repo2', typeSchemaUri: 'http://typeMatch6', folderPath: 'folder4/nested' }
      ];

      const skips: ItemTemplate[] = [
        // repo correct, type filtered out
        { label: 'item-nameMatch5', repoId: 'repo2', typeSchemaUri: 'http://type3', folderPath: 'folder3' },

        // repo correct, name filtered out
        { label: 'item-name7', repoId: 'repo2', typeSchemaUri: 'http://typeMatch3', folderPath: 'folder3' },
        { label: 'item-name8', repoId: 'repo2', typeSchemaUri: 'http://typeMatch5', folderPath: 'folder3/nested' },

        // folder correct, type filtered out
        { label: 'item-nameMatch6', repoId: 'repo1', typeSchemaUri: 'http://type3', folderPath: 'folder1' },

        // folder correct, name filtered out
        { label: 'item-name7', repoId: 'repo1', typeSchemaUri: 'http://typeMatch3', folderPath: 'folder1' },
        { label: 'item-name8', repoId: 'repo1', typeSchemaUri: 'http://typeMatch5', folderPath: 'folder1/nested' },

        // type and name correct/incorrect, repo and folder incorrect
        { label: 'item1', repoId: 'repo1', typeSchemaUri: 'http://type2' },
        { label: 'item-nameMatch1', repoId: 'repo1', typeSchemaUri: 'http://typeMatch2' },
        { label: 'item4', repoId: 'repo1', typeSchemaUri: 'http://type4', folderPath: 'folder2' },
        { label: 'item-nameMatch4', repoId: 'repo1', typeSchemaUri: 'http://typeMatch4', folderPath: 'folder2' },

        // folder correct, both filtered out
        { label: 'item5', repoId: 'repo1', typeSchemaUri: 'http://type1', folderPath: 'folder1' }
      ];

      const templates = skips.concat(exists);

      new MockContent(dynamicContentClientFactory as jest.Mock).importItemTemplates(templates);

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/export/allFilter/',
        repoId: 'repo2',
        folderId: 'folder1', // folder1 in addition to repo2
        name: '/nameMatch/',
        schemaId: '/typeMatch/' // only content that with name containing nameMatch and type containing typeMatch
      };
      await handler(argv);

      await itemsExist('temp/export/allFilter/', exists, ['repo2']);
      await itemsDontExist('temp/export/allFilter/', skips, ['repo2']);

      await rimraf('temp/export/allFilter/');
    });
  });
});
