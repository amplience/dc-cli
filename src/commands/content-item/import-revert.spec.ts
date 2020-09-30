import { revert } from './import-revert';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { writeFile } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';
import readline from 'readline';

import rmdir from 'rimraf';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { MockContent, ItemTemplate } from '../../common/dc-management-sdk-js/mock-content';
import { Status } from 'dc-management-sdk-js';

jest.mock('readline');
jest.mock('../../services/dynamic-content-client-factory');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('revert tests', function() {
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
    await rimraf('temp/revert/');
  });

  afterAll(async () => {
    await rimraf('temp/revert/');
  });

  async function createLog(logFileName: string, log: string): Promise<void> {
    const dir = dirname(logFileName);
    await ensureDirectoryExists(dir);
    await promisify(writeFile)(logFileName, log);
  }

  // Reverting a clean import (no updated content) should archive all imported content.
  // Reverting an import on top of existing content should revert to an older version of the content, and archive content that was created.
  // Attempting to revert an import of content that has since changed should warn the user.
  // User responding no to the content changed warning should abort the process.
  // Missing items when reverting (or already in the desired state) should be silently skipped.
  // Reverting an empty log should not do anything.

  // == FUNCTIONALITY TESTS ==
  test('Reverting a clean import (no updated content) should archive all imported content.', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (readline as any).setResponses([]);

    await createLog('temp/revert/createOnly.txt', 'CREATE id1\nCREATE id2\nCREATE id3');

    // Create content to import

    const templates: ItemTemplate[] = [
      { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
      { id: 'id2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
      { id: 'id3', label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
    ];

    const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
    mockContent.createMockRepository('repo');
    mockContent.registerContentType('http://type', 'type', 'repo');
    mockContent.importItemTemplates(templates);

    const argv = {
      ...yargArgs,
      ...config,
      revertLog: 'temp/revert/createOnly.txt',
      dir: '.'
    };
    await revert(argv);

    // check items were archived appropriately
    expect(mockContent.metrics.itemsArchived).toEqual(3);

    await rimraf('temp/revert/createOnly.txt');
  });

  test('Reverting an import on top of existing content should revert to an older version of the content, and archive content that was created.', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (readline as any).setResponses([]);

    await createLog('temp/revert/createImport.txt', 'UPDATE id1 1 2\nUPDATE id2 3 4\nCREATE id3');

    // Create content to import

    const templates: ItemTemplate[] = [
      { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type', version: 2 },
      { id: 'id2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest', version: 4 },
      { id: 'id3', label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
    ];

    const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
    mockContent.createMockRepository('repo');
    mockContent.registerContentType('http://type', 'type', 'repo');
    mockContent.importItemTemplates(templates);

    const argv = {
      ...yargArgs,
      ...config,
      revertLog: 'temp/revert/createImport.txt',
      dir: '.'
    };
    await revert(argv);

    // check items were archived appropriately
    expect(mockContent.metrics.itemsUpdated).toEqual(2);
    // check items were archived appropriately
    expect(mockContent.metrics.itemsArchived).toEqual(1);

    await rimraf('temp/revert/createImport.txt');
  });

  test('Attempting to revert an import of content that has since changed should warn the user and continue on prompt.', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (readline as any).setResponses(['y']);

    await createLog(
      'temp/revert/createWarn.txt',
      'UPDATE id1 1 2\nUPDATE id2 3 4\nCREATE id3\nUPDATE id4 3 4\nCREATE id5'
    );

    // Create content to import

    const templates: ItemTemplate[] = [
      { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type', version: 2 },

      // This content item has a higher version than the revert log. It should warn the user that there has been a change.
      { id: 'id2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest', version: 5 },

      { id: 'id3', label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' },

      // This content item has a higher version and is archived. This will act the same as unarchived, but warn the user.
      {
        id: 'id4',
        label: 'item4',
        repoId: 'repo',
        typeSchemaUri: 'http://type',
        folderPath: 'folderTest',
        version: 5,
        status: Status.DELETED
      },

      // This content item is archived, and it was created by the copy. Since it's already archived, nothing should happen.
      {
        id: 'id5',
        label: 'item3',
        repoId: 'repo',
        typeSchemaUri: 'http://type',
        folderPath: 'folderTest/nested',
        version: 2,
        status: Status.DELETED
      }
    ];

    const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
    mockContent.createMockRepository('repo');
    mockContent.registerContentType('http://type', 'type', 'repo');
    mockContent.importItemTemplates(templates);

    const argv = {
      ...yargArgs,
      ...config,
      revertLog: 'temp/revert/createWarn.txt',
      dir: '.'
    };
    await revert(argv);

    // check items were archived appropriately
    expect(mockContent.metrics.itemsUpdated).toEqual(3);
    // check items were archived appropriately
    expect(mockContent.metrics.itemsArchived).toEqual(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((readline as any).responsesLeft()).toEqual(0);

    await rimraf('temp/revert/createWarn.txt');
  });

  test('User responding no to the content changed warning should abort the process.', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (readline as any).setResponses(['n']);

    await createLog('temp/revert/revertAbort.txt', 'UPDATE id1 1 2\nUPDATE id2 3 4\nCREATE id3');

    // Create content to import

    const templates: ItemTemplate[] = [
      { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type', version: 2 },

      // This content item has a higher version than the revert log. It should warn the user that there has been a change.
      { id: 'id2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest', version: 5 },

      { id: 'id3', label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
    ];

    const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
    mockContent.createMockRepository('repo');
    mockContent.registerContentType('http://type', 'type', 'repo');
    mockContent.importItemTemplates(templates);

    const argv = {
      ...yargArgs,
      ...config,
      revertLog: 'temp/revert/revertAbort.txt',
      dir: '.'
    };
    const result = await revert(argv);

    expect(result).toBeFalsy();

    // check items were archived appropriately
    expect(mockContent.metrics.itemsUpdated).toEqual(0);
    // check items were archived appropriately
    expect(mockContent.metrics.itemsArchived).toEqual(0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((readline as any).responsesLeft()).toEqual(0);

    await rimraf('temp/revert/revertAbort.txt');
  });

  test('Missing/invalid/non-updated items when reverting (or already in the desired state) should be silently skipped.', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (readline as any).setResponses([]);

    await createLog(
      'temp/revert/revertSkip.txt',
      '// Title\n// Comment\nUPDATE id1 1 2\nUPDATE id2 3 4\nCREATE id3\nCREATE id4\nUPDATE id5 3 4\nCREATE id6\nUPDATE id7 23 24\nUPDATE id8 1 1\nUPDATE id9 0 1 invalid'
    );

    // Create content to import

    const templates: ItemTemplate[] = [
      { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type', version: 2 },
      { id: 'id2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest', version: 4 },
      { id: 'id3', label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
    ];

    const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
    mockContent.createMockRepository('repo');
    mockContent.registerContentType('http://type', 'type', 'repo');
    mockContent.importItemTemplates(templates);

    const argv = {
      ...yargArgs,
      ...config,
      revertLog: 'temp/revert/revertSkip.txt',
      dir: '.'
    };
    const result = await revert(argv);

    expect(result).toBeTruthy();

    // check items were archived appropriately
    expect(mockContent.metrics.itemsUpdated).toEqual(2);
    // check items were archived appropriately
    expect(mockContent.metrics.itemsArchived).toEqual(1);

    await rimraf('temp/revert/revertSkip.txt');
  });

  test('Reverting an empty log should not do anything.', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (readline as any).setResponses([]);

    await createLog('temp/revert/revertEmpty.txt', '// empty :)');

    // Create content to import

    const templates: ItemTemplate[] = [
      { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type' },
      { id: 'id2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest' },
      { id: 'id3', label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
    ];

    const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
    mockContent.createMockRepository('repo');
    mockContent.registerContentType('http://type', 'type', 'repo');
    mockContent.importItemTemplates(templates);

    const argv = {
      ...yargArgs,
      ...config,
      revertLog: 'temp/revert/revertEmpty.txt',
      dir: '.'
    };
    await revert(argv);

    // make sure nothing happened
    expect(mockContent.metrics.itemsArchived).toEqual(0);
    expect(mockContent.metrics.itemsUpdated).toEqual(0);

    await rimraf('temp/revert/revertEmpty.txt');
  });

  test('Failed requests should silently skip affected content.', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (readline as any).setResponses([]);

    await createLog(
      'temp/revert/revertSkip.txt',
      'UPDATE id1 1 2\nUPDATE id2 3 4\nCREATE id3\nCREATE id4\nUPDATE id5 3 4\nCREATE id6\nUPDATE id7 23 24'
    );

    // Create content to import

    const templates: ItemTemplate[] = [
      { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type', version: 2 },
      { id: 'id2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest', version: 4 },
      { id: 'id3', label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
    ];

    const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
    mockContent.createMockRepository('repo');
    mockContent.registerContentType('http://type', 'type', 'repo');
    mockContent.importItemTemplates(templates);
    mockContent.failItemActions = 'all';

    const argv = {
      ...yargArgs,
      ...config,
      revertLog: 'temp/revert/revertSkip.txt',
      dir: '.'
    };
    const result = await revert(argv);

    expect(result).toBeTruthy();

    // check items were archived appropriately
    expect(mockContent.metrics.itemsUpdated).toEqual(0);
    // check items were archived appropriately
    expect(mockContent.metrics.itemsArchived).toEqual(0);

    await rimraf('temp/revert/revertSkip.txt');
  });

  test('When the version request does not fail but updating it to that version does, skip the item.', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (readline as any).setResponses([]);

    await createLog('temp/revert/revertSkip2.txt', 'UPDATE id1 1 2');

    // Create content to import

    const templates: ItemTemplate[] = [
      { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type', version: 2 }
    ];

    const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
    mockContent.createMockRepository('repo');
    mockContent.registerContentType('http://type', 'type', 'repo');
    mockContent.importItemTemplates(templates);
    mockContent.failItemActions = 'not-version';

    const argv = {
      ...yargArgs,
      ...config,
      revertLog: 'temp/revert/revertSkip2.txt',
      dir: '.'
    };
    const result = await revert(argv);

    expect(result).toBeTruthy();

    // check items were archived appropriately
    expect(mockContent.metrics.itemsUpdated).toEqual(0);
    // check items were archived appropriately
    expect(mockContent.metrics.itemsArchived).toEqual(0);

    await rimraf('temp/revert/revertSkip2.txt');
  });

  test('Missing log should exit early.', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (readline as any).setResponses([]);

    // Create content to import

    const templates: ItemTemplate[] = [
      { id: 'id1', label: 'item1', repoId: 'repo', typeSchemaUri: 'http://type', version: 2 },
      { id: 'id2', label: 'item2', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest', version: 4 },
      { id: 'id3', label: 'item3', repoId: 'repo', typeSchemaUri: 'http://type', folderPath: 'folderTest/nested' }
    ];

    const mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
    mockContent.createMockRepository('repo');
    mockContent.registerContentType('http://type', 'type', 'repo');
    mockContent.importItemTemplates(templates);

    const argv = {
      ...yargArgs,
      ...config,
      revertLog: 'temp/revert/revertMissing.txt',
      dir: '.'
    };
    const result = await revert(argv);

    expect(result).toBeFalsy();

    // check items were archived appropriately
    expect(mockContent.metrics.itemsUpdated).toEqual(0);
    // check items were archived appropriately
    expect(mockContent.metrics.itemsArchived).toEqual(0);
  });
});
