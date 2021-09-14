import Yargs = require('yargs/yargs');

import { command, builder, handler, LOG_FILENAME } from './import';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Hub, Settings, WorkflowState } from 'dc-management-sdk-js';
import { promisify } from 'util';
import { exists, unlink, writeFile } from 'fs';
import rmdir from 'rimraf';
import { createLog } from '../../common/log-helpers';
import { FileLog } from '../../common/file-log';

jest.mock('readline');
jest.mock('../../services/dynamic-content-client-factory');

function rimraf(dir: string): Promise<Error> {
  return new Promise((resolve): void => {
    rmdir(dir, resolve);
  });
}

describe('settings import command', (): void => {
  const mockGetHub = jest.fn();
  const mockGetState = jest.fn();
  const mockCreateState = jest.fn();
  const mockUpdateState = jest.fn();
  const mockUpdateSettings = jest.fn();
  const mockQuestion = jest.fn();

  beforeEach(() => {
    mockCreateState.mockResolvedValue(
      new WorkflowState({
        id: '5f57a008c9e77c00018c0c29',
        label: 'new',
        createdBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
        createdDate: '2019-11-13T16:27:55.411Z',
        lastModifiedBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
        lastModifiedDate: '2019-11-13T16:27:55.411Z',
        color: 'rgb(25,195,151)',
        client: {
          fetchLinkedResource: jest.fn(),
          fetchResource: jest.fn(),
          createLinkedResource: jest.fn(),
          updateResource: jest.fn(),
          updateLinkedResource: jest.fn()
        },
        related: {
          workflowStates: {
            get: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
          }
        },
        _links: {
          self: {
            href:
              'https://api.amplience.net/v2/content/hubs/5b32377e4cedfd01c45036d8/workflow-states/5f57a008c9e77c00018c0c29'
          },
          update: {
            href:
              'https://api.amplience.net/v2/content/hubs/5b32377e4cedfd01c45036d8/workflow-states/5f57a008c9e77c00018c0c29'
          }
        }
      })
    );

    mockUpdateState.mockResolvedValue(
      new WorkflowState({
        id: '5f57a008c9e77c00018c0c29',
        label: 'new updated',
        createdBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
        createdDate: '2019-11-13T16:27:55.411Z',
        lastModifiedBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
        lastModifiedDate: '2019-11-13T16:27:55.411Z',
        color: 'rgb(25,195,151)',
        client: {
          fetchLinkedResource: jest.fn(),
          fetchResource: jest.fn(),
          createLinkedResource: jest.fn(),
          updateResource: jest.fn(),
          updateLinkedResource: jest.fn()
        },
        related: {
          workflowStates: {
            get: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
          }
        },
        _links: {
          self: {
            href:
              'https://api.amplience.net/v2/content/hubs/5b32377e4cedfd01c45036d8/workflow-states/5f57a008c9e77c00018c0c29'
          },
          update: {
            href:
              'https://api.amplience.net/v2/content/hubs/5b32377e4cedfd01c45036d8/workflow-states/5f57a008c9e77c00018c0c29'
          }
        }
      })
    );

    mockGetState.mockResolvedValue(
      new WorkflowState({
        id: '5f57a008c9e77c00018c0c29',
        label: 'new',
        createdBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
        createdDate: '2019-11-13T16:27:55.411Z',
        lastModifiedBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
        lastModifiedDate: '2019-11-13T16:27:55.411Z',
        color: 'rgb(25,195,151)',
        client: {
          fetchLinkedResource: jest.fn(),
          fetchResource: jest.fn(),
          createLinkedResource: jest.fn(),
          updateResource: jest.fn(),
          updateLinkedResource: jest.fn()
        },
        related: {
          workflowStates: {
            get: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
          }
        },
        _links: {
          self: {
            href:
              'https://api.amplience.net/v2/content/hubs/5b32377e4cedfd01c45036d8/workflow-states/5f57a008c9e77c00018c0c29'
          },
          update: {
            href:
              'https://api.amplience.net/v2/content/hubs/5b32377e4cedfd01c45036d8/workflow-states/5f57a008c9e77c00018c0c29'
          }
        }
      })
    );

    mockUpdateSettings.mockResolvedValue(
      new Settings({
        virtualStagingEnvironment: {
          hostname: 'xyz.staging.bigcontent.io'
        },
        previewVirtualStagingEnvironment: {
          hostname: 'xyz.staging.bigcontent.io'
        },
        applications: [
          {
            name: 'amplience',
            templatedUri: 'https://amplience.com/'
          }
        ],
        devices: [
          {
            name: 'Desktop',
            width: 1024,
            height: 768,
            orientate: false
          },
          {
            name: 'Tablet',
            width: 640,
            height: 768,
            orientate: false
          },
          {
            name: 'Mobile',
            width: 320,
            height: 512,
            orientate: false
          },
          {
            name: 'Mobile big',
            width: 768,
            height: 768,
            orientate: true
          }
        ],
        publishing: {
          platforms: {
            amplienceDam: {
              API_KEY: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e93e2',
              endpoint: 'amp'
            }
          }
        },
        localization: {
          locales: ['en-GB', 'de-DE', 'sv-SE', 'fr-BE', 'fr-FR']
        }
      })
    );

    mockGetHub.mockResolvedValue(
      new Hub({
        id: '5db1727bcff47e0001ce5fd2',
        name: 'amplienceclone1',
        label: 'Amplience Clone 1',
        description: null,
        status: 'ACTIVE',
        settings: {
          virtualStagingEnvironment: {
            hostname: 'xyz.staging.bigcontent.io'
          },
          previewVirtualStagingEnvironment: {
            hostname: 'xyz.staging.bigcontent.io'
          },
          applications: [
            {
              name: 'amplience',
              templatedUri: 'https://amplience.com/'
            }
          ],
          devices: [
            {
              name: 'Desktop',
              width: 1024,
              height: 768,
              orientate: false
            },
            {
              name: 'Tablet',
              width: 640,
              height: 768,
              orientate: false
            },
            {
              name: 'Mobile',
              width: 320,
              height: 512,
              orientate: false
            },
            {
              name: 'Mobile big',
              width: 768,
              height: 768,
              orientate: true
            }
          ],
          publishing: {
            platforms: {
              amplienceDam: {
                API_KEY: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e93e2',
                endpoint: 'amp'
              }
            }
          },
          localization: {
            locales: ['en-GB', 'de-DE', 'sv-SE', 'fr-BE', 'fr-FR']
          }
        },
        createdBy: '2f65cbc0-42e4-4899-8819-9b0cf9acf119',
        createdDate: '2019-10-24T09:44:27.853Z',
        lastModifiedBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
        lastModifiedDate: '2019-11-13T16:27:55.197Z',
        _links: {
          'workflow-states': {
            href: 'https://api.amplience.net/v2/content/hubs/5db1727bcff47e0001ce5fd2/workflow-states{?page,size,sort}',
            templated: true
          },
          'update-settings': {
            href: 'https://api.amplience.net/v2/content/hubs/5b32377e4cedfd01c45036d8/settings'
          },
          'create-workflow-state': {
            href: 'https://api.amplience.net/v2/content/hubs/5b32377e4cedfd01c45036d8/workflow-states'
          }
        },
        client: {
          fetchLinkedResource: mockGetHub,
          fetchResource: mockGetState,
          createLinkedResource: mockCreateState,
          updateResource: mockUpdateState,
          updateLinkedResource: mockUpdateSettings
        },
        related: {
          workflowStates: {
            get: mockGetState,
            create: mockCreateState,
            update: mockUpdateState
          },
          settings: {
            update: mockUpdateSettings
          }
        }
      })
    );

    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      hubs: {
        get: mockGetHub
      },
      workflowStates: {
        get: mockGetState
      }
    });
  });

  afterEach((): void => {
    jest.resetAllMocks();
    mockQuestion.mockClear();
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('should implement an import command', () => {
    expect(command).toEqual('import <filePath>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOptions = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('filePath', {
        describe: 'Source file path containing Settings definition',
        type: 'string'
      });

      expect(spyOptions).toHaveBeenCalledWith('mapFile', {
        type: 'string',
        requiresArg: false,
        describe:
          'Mapping file to use when updating workflow states that already exists. Updated with any new mappings that are generated. If not present, will be created.'
      });

      expect(spyOptions).toHaveBeenCalledWith('logFile', {
        type: 'string',
        default: LOG_FILENAME,
        describe: 'Path to a log file to write to.',
        coerce: createLog
      });

      expect(spyOptions).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'Overwrite workflow states without asking.'
      });
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
      hubId: '5db1727bcff47e0001ce5fd2'
    };
    const argv = {
      ...yargArgs,
      ...config,
      filePath: './settings-5db1727bcff47e0001ce5fd2.json'
    };

    const settingsMappingFile = { workflowStates: [['5dcc126052faff0001783741', '5f57a008c9e77c00018c0c29']] };

    const settingsExported = {
      id: '5db1727bcff47e0001ce5fd2',
      name: 'amplienceclone1',
      label: 'Amplience Clone 1',
      description: null,
      status: 'ACTIVE',
      settings: {
        virtualStagingEnvironment: {
          hostname: 'xyz.staging.bigcontent.io'
        },
        previewVirtualStagingEnvironment: {
          hostname: 'xyz.staging.bigcontent.io'
        },
        applications: [
          {
            name: 'amplience',
            templatedUri: 'https://amplience.com/'
          }
        ],
        devices: [
          {
            name: 'Desktop',
            width: 1024,
            height: 768,
            orientate: false
          },
          {
            name: 'Tablet',
            width: 640,
            height: 768,
            orientate: false
          },
          {
            name: 'Mobile',
            width: 320,
            height: 512,
            orientate: false
          },
          {
            name: 'Mobile big',
            width: 768,
            height: 768,
            orientate: true
          }
        ],
        publishing: {
          platforms: {
            amplienceDam: {
              API_KEY: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e93e2',
              endpoint: 'amp'
            }
          }
        },
        localization: {
          locales: ['en-GB', 'de-DE', 'sv-SE', 'fr-BE', 'fr-FR']
        }
      },
      createdBy: '2f65cbc0-42e4-4899-8819-9b0cf9acf119',
      createdDate: '2019-10-24T09:44:27.853Z',
      lastModifiedBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
      lastModifiedDate: '2019-11-13T16:27:55.197Z',
      workflowStates: [
        {
          id: '5dcc126052faff0001783741',
          label: 'new',
          createdBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
          createdDate: '2019-11-13T16:27:55.411Z',
          lastModifiedBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
          lastModifiedDate: '2019-11-13T16:27:55.411Z',
          color: 'rgb(25,195,151)'
        },
        {
          id: '5dcc126052faff0001783742',
          label: 'draft',
          createdBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
          createdDate: '2019-11-13T16:27:55.411Z',
          lastModifiedBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
          lastModifiedDate: '2019-11-13T16:27:55.411Z',
          color: 'rgb(25,195,151)'
        }
      ]
    };

    it('should process settings from a local directory', async () => {
      await rimraf('./mapSettings.json');
      await rimraf('./settings-5db1727bcff47e0001ce5fd2.json');
      await promisify(writeFile)('./mapSettings.json', JSON.stringify(settingsMappingFile));
      await promisify(writeFile)('./settings-5db1727bcff47e0001ce5fd2.json', JSON.stringify(settingsExported));

      await handler({
        ...argv,
        mapFile: './mapSettings.json',
        logFile: createLog('./log.json'),
        force: true
      });

      const fileExists = await promisify(exists)('./log.json');

      expect(mockGetHub).toHaveBeenCalled();
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
      expect(mockCreateState).toHaveBeenCalledTimes(1);
      expect(fileExists).toBeTruthy();

      await promisify(unlink)('./settings-5db1727bcff47e0001ce5fd2.json');
      await promisify(unlink)('./mapSettings.json');
      await promisify(unlink)('./log.json');
    });

    it("should process settings from a local directory, don't update existing", async () => {
      await rimraf('./mapSettings2.json');
      await rimraf('./settings-5db1727bcff47e0001ce5fd2.json');
      await promisify(writeFile)('./mapSettings2.json', JSON.stringify(settingsMappingFile));
      await promisify(writeFile)('./settings-5db1727bcff47e0001ce5fd2.json', JSON.stringify(settingsExported));

      await handler({
        ...argv,
        mapFile: './mapSettings2.json',
        force: true,
        answer: ['n'],
        logFile: new FileLog()
      });

      expect(mockGetHub).toHaveBeenCalled();

      await promisify(unlink)('./settings-5db1727bcff47e0001ce5fd2.json');
      await promisify(unlink)('./mapSettings2.json');
    });

    it('no map file', async () => {
      await rimraf('./settings-5db1727bcff47e0001ce5fd2.json');
      await promisify(writeFile)('./settings-5db1727bcff47e0001ce5fd2.json', JSON.stringify(settingsExported));

      await handler({
        ...argv,
        force: true,
        logFile: new FileLog()
      });

      expect(mockGetHub).toHaveBeenCalled();

      await promisify(unlink)('./settings-5db1727bcff47e0001ce5fd2.json');
    });
  });
});
