import { Arguments } from 'yargs';
import { MockContent } from '../../../common/dc-management-sdk-js/mock-content';
import { FileLog } from '../../../common/file-log';
import { ensureDirectoryExists } from '../../../common/import/directory-utils';
import { CloneHubBuilderOptions } from '../../../interfaces/clone-hub-builder-options';
import dynamicContentClientFactory from '../../../services/dynamic-content-client-factory';
import { ConfigurationParameters } from '../../configure';
import { CloneHubState } from '../model/clone-hub-state';
import { join } from 'path';
import rmdir from 'rimraf';

import * as schemaImport from '../../content-type-schema/import';
import * as schemaExport from '../../content-type-schema/export';

import { SchemaCloneStep } from './schema-clone-step';

jest.mock('../../../services/dynamic-content-client-factory');
jest.mock('../../content-type-schema/import');
jest.mock('../../content-type-schema/export');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('schema clone step', () => {
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

  function reset(): void {
    jest.resetAllMocks();

    mockContent = new MockContent(dynamicContentClientFactory as jest.Mock);
    mockContent.createMockRepository('targetRepo');
    mockContent.registerContentType('http://type', 'type', 'targetRepo');
    mockContent.registerContentType('http://type2', 'type2', 'targetRepo');
    mockContent.registerContentType('http://type3', 'type3', 'targetRepo');
  }

  beforeEach(async () => {
    reset();
  });

  beforeAll(async () => {
    await rimraf('temp/clone-schema/');
  });

  afterAll(async () => {
    await rimraf('temp/clone-schema/');
  });

  function generateState(directory: string, logName: string): CloneHubState {
    const argv: Arguments<CloneHubBuilderOptions & ConfigurationParameters> = {
      ...yargArgs,
      ...config,

      dir: directory,

      dstHubId: 'hub2-id',
      dstClientId: 'acc2-id',
      dstSecret: 'acc2-secret'
    };

    return {
      argv: argv,
      from: {
        clientId: argv.clientId as string,
        clientSecret: argv.clientSecret as string,
        hubId: argv.hubId as string,
        ...yargArgs
      },
      to: {
        clientId: argv.dstClientId as string,
        clientSecret: argv.dstSecret as string,
        hubId: argv.dstHubId as string,
        ...yargArgs
      },
      path: directory,
      logFile: new FileLog(join(directory, logName + '.log'))
    };
  }

  it('should have the name "Clone Content Type Schemas"', () => {
    const step = new SchemaCloneStep();
    expect(step.getName()).toEqual('Clone Content Type Schemas');
  });

  it('should call export on the source and import to the destination', async () => {
    const state = generateState('temp/clone-schema/run/', 'run');

    (schemaImport.handler as jest.Mock).mockResolvedValue(true);
    (schemaExport.handler as jest.Mock).mockResolvedValue(true);

    const step = new SchemaCloneStep();
    const result = await step.run(state);

    expect(schemaExport.handler).toHaveBeenCalledWith({
      dir: join(state.path, 'schema'),
      force: true,
      logFile: state.logFile,
      ...state.from
    });

    expect(schemaImport.handler).toBeCalledWith({
      dir: join(state.path, 'schema'),
      logFile: state.logFile,
      ...state.to
    });

    expect(result).toBeTruthy();
  });

  it('should fail the step when the export or import fails', async () => {
    const state = generateState('temp/clone-schema/run/', 'run');

    (schemaExport.handler as jest.Mock).mockRejectedValue(false);

    const step = new SchemaCloneStep();
    const exportFail = await step.run(state);

    expect(exportFail).toBeFalsy();
    expect(schemaExport.handler).toHaveBeenCalled();
    expect(schemaImport.handler).not.toHaveBeenCalled();

    reset();

    (schemaExport.handler as jest.Mock).mockResolvedValue(true);
    (schemaImport.handler as jest.Mock).mockRejectedValue(false);

    const importFail = await step.run(state);

    expect(importFail).toBeFalsy();
    expect(schemaExport.handler).toHaveBeenCalled();
    expect(schemaImport.handler).toHaveBeenCalled();
  });

  it('should attempt to archive schemas with the CREATE action on revert, skipping archived schemas', async () => {
    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Content Type Schemas');
    fakeLog.addAction('CREATE', 'type');
    fakeLog.addAction('CREATE', 'type3'); // is archived

    const state = generateState('temp/clone-schema/revert-create/', 'revert-create');

    const client = dynamicContentClientFactory(config);
    await (await client.contentTypeSchemas.get('type3')).related.archive();

    state.revertLog = fakeLog;
    mockContent.metrics.typeSchemasArchived = 0;

    const step = new SchemaCloneStep();
    await step.revert(state);

    expect(mockContent.metrics.typeSchemasArchived).toEqual(1);
  });

  it('should attempt to fetch and revert to the version of the schema in the revert log', async () => {
    const state = generateState('temp/clone-schema/revert-update/', 'revert-update');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Content Type Schemas');
    fakeLog.addAction('CREATE', 'type');
    fakeLog.addAction('UPDATE', 'type2 0 1');

    await ensureDirectoryExists('temp/clone-schema/revert-update/oldType');

    state.revertLog = fakeLog;

    const step = new SchemaCloneStep();
    const result = await step.revert(state);

    expect(mockContent.metrics.typeSchemasArchived).toEqual(1);
    expect(mockContent.metrics.typeSchemasUpdated).toEqual(1);

    expect(result).toBeTruthy();
  });

  it('should return true when importing types for revert fails (ignore)', async () => {
    const state = generateState('temp/clone-schema/revert-fail/', 'revert-fail');

    const fakeLog = new FileLog();
    fakeLog.switchGroup('Clone Content Type Schemas');
    fakeLog.addAction('CREATE', 'type');
    fakeLog.addAction('UPDATE', 'type2 0 1');

    await ensureDirectoryExists('temp/clone-schema/revert-fail/oldType');

    state.revertLog = fakeLog;
    mockContent.failSchemaActions = 'all';

    const step = new SchemaCloneStep();
    const result = await step.revert(state);

    expect(mockContent.metrics.typeSchemasArchived).toEqual(0);
    expect(mockContent.metrics.typeSchemasUpdated).toEqual(0);

    expect(result).toBeTruthy();
  });
});
