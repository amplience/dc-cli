import { builder, command, handler, LOG_FILENAME, getDefaultMappingPath } from './clone';
import { getDefaultLogPath } from '../../common/log-helpers';
import { ensureDirectoryExists } from '../../common/import/directory-utils';
import { writeFileSync } from 'fs';
import Yargs from 'yargs/yargs';

import * as settingsImport from '../settings/import';
import * as settingsExport from '../settings/export';
import * as schemaImport from '../content-type-schema/import';
import * as schemaExport from '../content-type-schema/export';
import * as typeImport from '../content-type/import';
import * as typeExport from '../content-type/export';
import * as copier from '../content-item/copy';

import rmdir from 'rimraf';
import { CloneHubBuilderOptions } from '../../interfaces/clone-hub-builder-options';
import { ConfigurationParameters } from '../configure';
import { Arguments } from 'yargs';
import { CopyItemBuilderOptions } from '../../interfaces/copy-item-builder-options.interface';
import { FileLog } from '../../common/file-log';
import { MockContent } from '../../common/dc-management-sdk-js/mock-content';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';

jest.mock('readline');

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../settings/import');
jest.mock('../settings/export');
jest.mock('../content-type-schema/import');
jest.mock('../content-type-schema/export');
jest.mock('../content-type/import');
jest.mock('../content-type/export');
jest.mock('../content-item/copy');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const copierAny = copier as any;

jest.mock('../../common/log-helpers', () => ({
  ...jest.requireActual('../../common/log-helpers'),
  getDefaultLogPath: jest.fn()
}));

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function succeedOrFail(mock: any, succeed: boolean): void {
  if (succeed) {
    mock.mockResolvedValue(true);
  } else {
    mock.mockRejectedValue(false);
  }
}

describe('hub clone command', () => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should command should defined', function() {
    expect(command).toEqual('clone <dir>');
  });

  it('should use getDefaultLogPath for LOG_FILENAME with process.platform as default', function() {
    LOG_FILENAME();

    expect(getDefaultLogPath).toHaveBeenCalledWith('hub', 'clone', process.platform);
  });

  it('should generate a default mapping path containing the given name', function() {
    expect(getDefaultMappingPath('hub-1').indexOf('hub-1')).not.toEqual(-1);
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe:
          'Directory to export content to, then import from. This must be set to the previous directory for a revert.',
        type: 'string'
      });

      expect(spyOption).toHaveBeenCalledWith('dstHubId', {
        type: 'string',
        describe: 'Destination hub ID. If not specified, it will be the same as the source.'
      });

      expect(spyOption).toHaveBeenCalledWith('dstClientId', {
        type: 'string',
        describe: "Destination account's client ID. If not specified, it will be the same as the source."
      });

      expect(spyOption).toHaveBeenCalledWith('dstSecret', {
        type: 'string',
        describe: "Destination account's secret. Must be used alongside dstClientId."
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

      expect(spyOption).toHaveBeenCalledWith('skipIncomplete', {
        type: 'boolean',
        boolean: true,
        describe: 'Skip any content item that has one or more missing dependancy.'
      });

      expect(spyOption).toHaveBeenCalledWith('copyConfig', {
        type: 'string',
        describe:
          'Path to a JSON configuration file for source/destination account. If the given file does not exist, it will be generated from the arguments.'
      });

      expect(spyOption).toHaveBeenCalledWith('lastPublish', {
        type: 'boolean',
        boolean: true,
        describe: 'When available, export the last published version of a content item rather than its newest version.'
      });

      expect(spyOption).toHaveBeenCalledWith('publish', {
        type: 'boolean',
        boolean: true,
        describe: 'Publish any content items that have an existing publish status in their JSON.'
      });

      expect(spyOption).toHaveBeenCalledWith('republish', {
        type: 'boolean',
        boolean: true,
        describe:
          'Republish content items regardless of whether the import changed them or not. (--publish not required)'
      });

      expect(spyOption).toHaveBeenCalledWith('excludeKeys', {
        type: 'boolean',
        boolean: true,
        describe: 'Exclude delivery keys when importing content items.'
      });

      expect(spyOption).toHaveBeenCalledWith('media', {
        type: 'boolean',
        boolean: true,
        describe:
          "Detect and rewrite media links to match assets in the target account's DAM. Your client must have DAM permissions configured."
      });

      expect(spyOption).toHaveBeenCalledWith('revertLog', {
        type: 'string',
        describe:
          'Revert a previous clone using a given revert log and given directory. Reverts steps in reverse order, starting at the specified one.'
      });

      expect(spyOption).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.'
      });
    });
  });

  describe('handler tests', function() {
    const yargArgs = {
      $0: 'test',
      _: ['test']
    };

    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    beforeEach(async () => {
      jest.mock('readline');
      jest.mock('../../services/dynamic-content-client-factory');
    });

    beforeAll(async () => {
      await rimraf('temp/clone/');
    });

    afterAll(async () => {
      await rimraf('temp/clone/');
    });

    it('should call all steps in order with given parameters', async () => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;
      copyCalls.splice(0, copyCalls.length);

      copierAny.setForceFail(false);

      const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        dir: 'temp/clone/steps',

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',

        mapFile: 'map.json',
        force: false,
        validate: false,
        skipIncomplete: false,
        media: true
      };

      const configImport = {
        hubId: 'hub2-id',
        clientId: 'acc2-id',
        clientSecret: 'acc2-secret'
      };

      await ensureDirectoryExists('temp/clone/steps/settings');
      writeFileSync('temp/clone/steps/settings/hub-hub-id-test.json', '{}');

      await handler(argv);

      expect(settingsExport.handler).toHaveBeenCalledWith({
        ...yargArgs,
        ...config,
        dir: 'temp/clone/steps/settings',
        logFile: expect.any(FileLog),
        force: false
      });
      // Also backs up the destination settings.
      expect(settingsExport.handler).toHaveBeenCalledWith({
        ...yargArgs,
        ...configImport,
        dir: 'temp/clone/steps/settings',
        logFile: expect.any(FileLog),
        force: false
      });
      expect(settingsImport.handler).toHaveBeenCalledWith({
        ...yargArgs,
        ...configImport,
        filePath: 'temp/clone/steps/settings/hub-hub-id-test.json',
        logFile: expect.any(FileLog),
        mapFile: 'map.json',
        force: false
      });
      expect(schemaExport.handler).toHaveBeenCalledWith({
        ...yargArgs,
        ...config,
        dir: 'temp/clone/steps/schema',
        logFile: expect.any(FileLog),
        force: false
      });
      expect(schemaImport.handler).toHaveBeenCalledWith({
        ...yargArgs,
        ...configImport,
        dir: 'temp/clone/steps/schema',
        logFile: expect.any(FileLog)
      });
      expect(typeExport.handler).toHaveBeenCalledWith({
        ...yargArgs,
        ...config,
        dir: 'temp/clone/steps/type',
        logFile: expect.any(FileLog),
        force: false
      });
      expect(typeImport.handler).toHaveBeenCalledWith({
        ...yargArgs,
        ...configImport,
        dir: 'temp/clone/steps/type',
        sync: true,
        logFile: expect.any(FileLog)
      });

      expect(copyCalls.length).toEqual(1);

      expect(copyCalls[0].clientId).toEqual(config.clientId);
      expect(copyCalls[0].clientSecret).toEqual(config.clientSecret);
      expect(copyCalls[0].hubId).toEqual(config.hubId);
      expect(copyCalls[0].schemaId).toEqual(argv.schemaId);
      expect(copyCalls[0].name).toEqual(argv.name);
      expect(copyCalls[0].srcRepo).toEqual(argv.srcRepo);
      expect(copyCalls[0].dstRepo).toEqual(argv.dstRepo);
      expect(copyCalls[0].dstHubId).toEqual(argv.dstHubId);
      expect(copyCalls[0].dstSecret).toEqual(argv.dstSecret);

      expect(copyCalls[0].force).toEqual(argv.force);
      expect(copyCalls[0].validate).toEqual(argv.validate);
      expect(copyCalls[0].skipIncomplete).toEqual(argv.skipIncomplete);
      expect(copyCalls[0].media).toEqual(argv.media);
    });

    it('should handle exceptions from each of the steps by stopping the process', async () => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;

      copierAny.setForceFail(false);

      for (let i = 1; i <= 7; i++) {
        jest.resetAllMocks();
        copyCalls.splice(0, copyCalls.length);

        copierAny.setForceFail(i == 7);

        succeedOrFail(settingsExport.handler, i != 1);
        succeedOrFail(settingsImport.handler, i != 2);

        succeedOrFail(schemaExport.handler, i != 3);
        succeedOrFail(schemaImport.handler, i != 4);

        succeedOrFail(typeExport.handler, i != 5);
        succeedOrFail(typeImport.handler, i != 6);

        const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
          ...yargArgs,
          ...config,

          dir: 'temp/clone/stepExcept',

          dstHubId: 'hub2-id',
          dstClientId: 'acc2-id',
          dstSecret: 'acc2-secret'
        };

        await ensureDirectoryExists('temp/clone/stepExcept/settings');
        writeFileSync('temp/clone/stepExcept/settings/hub-hub-id-test.json', '{}');

        await handler(argv);

        expect(settingsExport.handler).toHaveBeenCalledTimes(i == 1 ? 1 : 2);
        expect(settingsImport.handler).toHaveBeenCalledTimes(i >= 2 ? 1 : 0);

        expect(schemaExport.handler).toHaveBeenCalledTimes(i >= 3 ? 1 : 0);
        expect(schemaImport.handler).toHaveBeenCalledTimes(i >= 4 ? 1 : 0);

        expect(typeExport.handler).toHaveBeenCalledTimes(i == 5 ? 1 : i > 5 ? 2 : 0);
        expect(typeImport.handler).toHaveBeenCalledTimes(i >= 6 ? 1 : 0);

        expect(copyCalls.length).toEqual(i >= 7 ? 1 : 0);
      }
    });

    it('should start from the step given as a parameter', async () => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;

      succeedOrFail(settingsExport.handler, true);
      succeedOrFail(settingsImport.handler, true);

      succeedOrFail(schemaExport.handler, true);
      succeedOrFail(schemaImport.handler, true);

      succeedOrFail(typeExport.handler, true);
      succeedOrFail(typeImport.handler, true);

      copierAny.setForceFail(false);

      for (let i = 1; i <= 4; i++) {
        jest.resetAllMocks();
        copyCalls.splice(0, copyCalls.length);

        const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
          ...yargArgs,
          ...config,

          dir: 'temp/clone/stepStart',

          dstHubId: 'hub2-id',
          dstClientId: 'acc2-id',
          dstSecret: 'acc2-secret',

          step: i
        };

        await ensureDirectoryExists('temp/clone/stepStart/settings');
        writeFileSync('temp/clone/stepStart/settings/hub-hub-id-test.json', '{}');

        await handler(argv);

        expect(settingsExport.handler).toHaveBeenCalledTimes(i <= 1 ? 2 : 0);
        expect(settingsImport.handler).toHaveBeenCalledTimes(i <= 1 ? 1 : 0);

        expect(schemaExport.handler).toHaveBeenCalledTimes(i <= 2 ? 1 : 0);
        expect(schemaImport.handler).toHaveBeenCalledTimes(i <= 2 ? 1 : 0);

        expect(typeExport.handler).toHaveBeenCalledTimes(i <= 3 ? 2 : 0);
        expect(typeImport.handler).toHaveBeenCalledTimes(i <= 3 ? 1 : 0);

        expect(copyCalls.length).toEqual(1);
      }
    });
  });

  describe('revert tests', function() {
    let mockContent: MockContent;

    const yargArgs = {
      $0: 'test',
      _: ['test']
    };

    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    beforeEach(async () => {
      jest.resetAllMocks();
      jest.mock('readline');

      mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
      mockContent.createMockRepository('targetRepo');
      mockContent.registerContentType('http://type', 'type', 'targetRepo');
      mockContent.registerContentType('http://type2', 'type2', 'targetRepo');
      mockContent.registerContentType('http://type3', 'type3', 'targetRepo');
    });

    beforeAll(async () => {
      await rimraf('temp/clone-revert/');
    });

    afterAll(async () => {
      await rimraf('temp/clone-revert/');
    });

    function expectTypeSchemaRevert(schemaArchived: boolean, typeArchived: boolean): void {
      if (schemaArchived) {
        expect(mockContent.metrics.typeSchemasArchived).toEqual(1);
        expect(mockContent.metrics.typeSchemasUpdated).toEqual(1);
      } else {
        expect(mockContent.metrics.typeSchemasArchived).toEqual(0);
        expect(mockContent.metrics.typeSchemasUpdated).toEqual(0);
      }

      if (typeArchived) {
        expect(mockContent.metrics.typesArchived).toEqual(1);
      } else {
        expect(mockContent.metrics.typesArchived).toEqual(0);
      }
    }

    async function prepareFakeLog(path: string): Promise<void> {
      const fakeLog = new FileLog(path + 'steps.log');
      fakeLog.switchGroup('Clone Content Types');
      fakeLog.addAction('CREATE', 'type');
      fakeLog.addAction('UPDATE', 'type2 0 1');
      fakeLog.switchGroup('Clone Content Type Schema');
      fakeLog.addAction('CREATE', 'type');
      fakeLog.addAction('UPDATE', 'type2 0 1');
      await fakeLog.close();
    }

    it('should call revert all steps in order with given parameters', async () => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;
      copyCalls.splice(0, copyCalls.length);

      copierAny.setForceFail(false);

      await prepareFakeLog('temp/clone-revert/');

      const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
        ...yargArgs,
        ...config,

        dir: 'temp/clone-revert/steps',

        dstHubId: 'hub2-id',
        dstClientId: 'acc2-id',
        dstSecret: 'acc2-secret',

        mapFile: 'map.json',
        force: false,

        revertLog: 'temp/clone-revert/steps.log'
      };

      const configImport = {
        hubId: 'hub2-id',
        clientId: 'acc2-id',
        clientSecret: 'acc2-secret'
      };

      await ensureDirectoryExists('temp/clone-revert/steps/settings');
      writeFileSync('temp/clone-revert/steps/settings/hub-hub2-id-test.json', '{}');

      await ensureDirectoryExists('temp/clone-revert/steps/oldType');

      await handler(argv);

      expect(settingsImport.handler).toHaveBeenCalledWith({
        ...yargArgs,
        ...configImport,
        filePath: 'temp/clone-revert/steps/settings/hub-hub2-id-test.json',
        logFile: expect.any(FileLog),
        mapFile: 'map.json',
        force: false
      });

      expect(typeImport.handler).toHaveBeenCalledWith(
        {
          ...yargArgs,
          ...configImport,
          dir: 'temp/clone-revert/steps/oldType',
          sync: true,
          logFile: expect.any(FileLog)
        },
        ['type2']
      );

      expectTypeSchemaRevert(true, true);

      expect(copyCalls.length).toEqual(1);

      expect(copyCalls[0].revertLog).toEqual(expect.any(FileLog));
      expect(copyCalls[0].clientId).toEqual(config.clientId);
      expect(copyCalls[0].clientSecret).toEqual(config.clientSecret);
      expect(copyCalls[0].hubId).toEqual(config.hubId);
      expect(copyCalls[0].schemaId).toEqual(argv.schemaId);
      expect(copyCalls[0].name).toEqual(argv.name);
      expect(copyCalls[0].srcRepo).toEqual(argv.srcRepo);
      expect(copyCalls[0].dstRepo).toEqual(argv.dstRepo);
      expect(copyCalls[0].dstHubId).toEqual(argv.dstHubId);
      expect(copyCalls[0].dstSecret).toEqual(argv.dstSecret);

      expect(copyCalls[0].force).toEqual(argv.force);
    });

    it('should handle exceptions from each of the revert steps by stopping the process', async () => {
      const copyCalls: Arguments<CopyItemBuilderOptions & ConfigurationParameters>[] = copierAny.calls;

      copierAny.setForceFail(false);

      for (let i = 1; i <= 7; i++) {
        jest.resetAllMocks();
        copyCalls.splice(0, copyCalls.length);

        copierAny.setForceFail(i == 7);

        succeedOrFail(settingsExport.handler, i != 1);
        succeedOrFail(settingsImport.handler, i != 2);

        succeedOrFail(schemaExport.handler, i != 3);
        succeedOrFail(schemaImport.handler, i != 4);

        succeedOrFail(typeExport.handler, i != 5);
        succeedOrFail(typeImport.handler, i != 6);

        const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
          ...yargArgs,
          ...config,

          dir: 'temp/clone/stepExcept',

          dstHubId: 'hub2-id',
          dstClientId: 'acc2-id',
          dstSecret: 'acc2-secret'
        };

        await ensureDirectoryExists('temp/clone/stepExcept/settings');
        writeFileSync('temp/clone/stepExcept/settings/hub-hub-id-test.json', '{}');

        await handler(argv);

        expect(settingsExport.handler).toHaveBeenCalledTimes(i == 1 ? 1 : 2);
        expect(settingsImport.handler).toHaveBeenCalledTimes(i >= 2 ? 1 : 0);

        expect(schemaExport.handler).toHaveBeenCalledTimes(i >= 3 ? 1 : 0);
        expect(schemaImport.handler).toHaveBeenCalledTimes(i >= 4 ? 1 : 0);

        expect(typeExport.handler).toHaveBeenCalledTimes(i == 5 ? 1 : i > 5 ? 2 : 0);
        expect(typeImport.handler).toHaveBeenCalledTimes(i >= 6 ? 1 : 0);

        expect(copyCalls.length).toEqual(i >= 7 ? 1 : 0);
      }
    });

    it('should start reverting from the step given as a parameter (steps in decreasing order)', async () => {});
  });
});
