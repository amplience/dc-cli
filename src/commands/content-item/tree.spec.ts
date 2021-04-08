// Copy tests are rather simple since they most of the work is done by import/export.
// Unique features are revert, throwing when parameters are wrong/missing,
// and forwarding input parameters to both import and export.

import { builder, command, handler, firstSecondThird, fillWhitespace, LOG_FILENAME } from './tree';
import Yargs from 'yargs/yargs';

import { writeFile } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

import { ensureDirectoryExists } from '../../common/import/directory-utils';
import rmdir from 'rimraf';
import { getDefaultLogPath } from '../../common/log-helpers';

import { ItemTemplate } from '../../common/dc-management-sdk-js/mock-content';
import { dependsOn } from '../../commands/content-item/__mocks__/dependant-content-helper';
import { ContentItem, Status } from 'dc-management-sdk-js';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../common/log-helpers');

const consoleLogSpy = jest.spyOn(console, 'log');
const consoleErrorSpy = jest.spyOn(console, 'error');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('content-item tree command', () => {
  afterEach((): void => {
    jest.resetAllMocks();
  });

  it('should command should defined', function() {
    expect(command).toEqual('tree <dir>');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        type: 'string',
        describe: 'Path to the content items to build a tree from. Should be in the same format as an export.'
      });
    });
  });

  describe('firstSecondThird tests', function() {
    it('should return 0 for the first item in a list, above size 1', () => {
      expect(firstSecondThird(0, 2)).toEqual(0);
      expect(firstSecondThird(0, 3)).toEqual(0);
      expect(firstSecondThird(0, 4)).toEqual(0);
    });

    it('should return 2 for the last item in a list', () => {
      expect(firstSecondThird(0, 1)).toEqual(2);
      expect(firstSecondThird(1, 2)).toEqual(2);
      expect(firstSecondThird(2, 3)).toEqual(2);
      expect(firstSecondThird(3, 4)).toEqual(2);
    });

    it('should return 1 for any middle item in a list, above size 2', () => {
      expect(firstSecondThird(1, 3)).toEqual(1);
      expect(firstSecondThird(1, 4)).toEqual(1);
      expect(firstSecondThird(2, 4)).toEqual(1);
    });
  });

  describe('fillWhitespace tests', function() {
    it('should fill space characters only after the original string with the given character up to the length', () => {
      expect(fillWhitespace('    ', '    ', '-', 4)).toEqual('    ');
      expect(fillWhitespace('    ', '    ', '-', 8)).toEqual('    ----');
    });

    it('should inherit non-space characters from the current string', () => {
      expect(fillWhitespace('    ', '    char', '-', 4)).toEqual('    char');
      expect(fillWhitespace('    ', '    char', '-', 8)).toEqual('    char');
      expect(fillWhitespace('    ', '    c a ', '-', 8)).toEqual('    c-a-');
      expect(fillWhitespace('    ', '     h r', '-', 8)).toEqual('    -h-r');
      expect(fillWhitespace('    ', '        ', '-', 8)).toEqual('    ----');
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
      await rimraf('temp/tree/');
    });

    beforeEach(() => {
      jest.resetAllMocks();
    });

    const itemFromTemplate = (template: ItemTemplate): ContentItem => {
      const item = new ContentItem({
        label: template.label,
        status: template.status || Status.ACTIVE,
        id: template.id || template.label,
        folderId: null,
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

      return item;
    };

    const createContent = async (basePath: string, template: ItemTemplate): Promise<void> => {
      await promisify(writeFile)(
        join(basePath, template.label + '.json'),
        JSON.stringify(itemFromTemplate(template).toJSON())
      );
    };

    it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function() {
      LOG_FILENAME();

      expect(getDefaultLogPath).toHaveBeenCalledWith('item', 'tree', process.platform);
    });

    it('should print nothing if no content is present', async () => {
      await ensureDirectoryExists('temp/tree/empty');

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/tree/empty'
      };

      await handler(argv);

      expect(consoleLogSpy.mock.calls.map(args => args[0]).join('\n')).toMatchSnapshot();
    });

    it('should print a single content item by itself', async () => {
      const basePath = 'temp/tree/single/repo1';
      await ensureDirectoryExists(basePath);

      await promisify(writeFile)(join(basePath, 'dummyFile.txt'), 'ignored');

      await createContent(basePath, {
        label: 'item1',
        id: 'id1',
        repoId: 'repo1',
        body: {},
        typeSchemaUri: 'http://type.com'
      });

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/tree/single'
      };

      await handler(argv);

      expect(consoleLogSpy.mock.calls.map(args => args[0]).join('\n')).toMatchSnapshot();
    });

    it('should print a tree of content items', async () => {
      const basePath = 'temp/tree/multiple/repo1';
      await ensureDirectoryExists(basePath);

      const shared = { typeSchemaUri: 'http://type.com', repoId: 'repo1' };

      await createContent(basePath, { label: 'item1', id: 'id1', body: dependsOn(['id2', 'id3']), ...shared });
      await createContent(basePath, { label: 'item2', id: 'id2', body: dependsOn(['id4', 'id6']), ...shared });
      await createContent(basePath, { label: 'item3', id: 'id3', body: {}, ...shared });
      await createContent(basePath, { label: 'item4', id: 'id4', body: {}, ...shared });
      await createContent(basePath, { label: 'item5', id: 'id5', body: {}, ...shared });
      await createContent(basePath, { label: 'item6', id: 'id6', body: dependsOn(['id5']), ...shared });

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/tree/multiple'
      };

      await handler(argv);

      expect(consoleLogSpy.mock.calls.map(args => args[0]).join('\n')).toMatchSnapshot();
    });

    it('should print multiple disjoint trees of content items', async () => {
      const basePath = 'temp/tree/disjoint/repo1';
      await ensureDirectoryExists(basePath);

      const shared = { typeSchemaUri: 'http://type.com', repoId: 'repo1' };

      await createContent(basePath, { label: 'item1', id: 'id1', body: dependsOn(['id2', 'id3']), ...shared });
      await createContent(basePath, { label: 'item2', id: 'id2', body: dependsOn(['id4']), ...shared });
      await createContent(basePath, { label: 'item3', id: 'id3', body: {}, ...shared });
      await createContent(basePath, { label: 'item4', id: 'id4', body: {}, ...shared });

      await createContent(basePath, { label: 'item5', id: 'id5', body: {}, ...shared });
      await createContent(basePath, { label: 'item6', id: 'id6', body: dependsOn(['id5']), ...shared });

      await createContent(basePath, { label: 'item7', id: 'id7', body: {}, ...shared });

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/tree/disjoint'
      };

      await handler(argv);

      expect(consoleLogSpy.mock.calls.map(args => args[0]).join('\n')).toMatchSnapshot();
    });

    it('should detect and print circular dependencies with a double line indicator', async () => {
      const basePath = 'temp/tree/disjoint/repo1';
      await ensureDirectoryExists(basePath);

      const shared = { typeSchemaUri: 'http://type.com', repoId: 'repo1' };

      await createContent(basePath, { label: 'item1', id: 'id1', body: dependsOn(['id2', 'id3']), ...shared });
      await createContent(basePath, { label: 'item2', id: 'id2', body: dependsOn(['id4']), ...shared });
      await createContent(basePath, { label: 'item3', id: 'id3', body: {}, ...shared });
      await createContent(basePath, { label: 'item4', id: 'id4', body: dependsOn(['id1']), ...shared });

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/tree/disjoint'
      };

      await handler(argv);

      expect(consoleLogSpy.mock.calls.map(args => args[0]).join('\n')).toMatchSnapshot();
    });

    it('should detect intertwined circular dependencies with multiple lines with different position', async () => {
      const basePath = 'temp/tree/intertwine/repo1';
      await ensureDirectoryExists(basePath);

      const shared = { typeSchemaUri: 'http://type.com', repoId: 'repo1' };

      await createContent(basePath, { label: 'item1', id: 'id1', body: dependsOn(['id2']), ...shared });
      await createContent(basePath, { label: 'item2', id: 'id2', body: dependsOn(['id3']), ...shared });
      await createContent(basePath, { label: 'item3', id: 'id3', body: dependsOn(['id2', 'id4']), ...shared });
      await createContent(basePath, { label: 'item4', id: 'id4', body: dependsOn(['id1', 'id5']), ...shared });

      await createContent(basePath, { label: 'item5', id: 'id5', body: dependsOn(['id6']), ...shared });
      await createContent(basePath, { label: 'item6', id: 'id6', body: dependsOn(['id5']), ...shared });

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/tree/intertwine'
      };

      await handler(argv);

      expect(consoleLogSpy.mock.calls.map(args => args[0]).join('\n')).toMatchSnapshot();
    });

    it('should print an error when invalid json is found', async () => {
      const basePath = 'temp/tree/invalud/repo1';
      await ensureDirectoryExists(basePath);

      await createContent(basePath, {
        label: 'item1',
        id: 'id1',
        repoId: 'repo1',
        body: {},
        typeSchemaUri: 'http://type.com'
      });
      await promisify(writeFile)(join(basePath, 'badfile.json'), 'not json');

      const argv = {
        ...yargArgs,
        ...config,
        dir: 'temp/tree/invalud'
      };

      await handler(argv);

      expect(consoleLogSpy.mock.calls.map(args => args[0]).join('\n')).toMatchSnapshot();
      expect(consoleErrorSpy.mock.calls.map(args => args[0]).join('\n')).toMatchSnapshot();
    });
  });
});
