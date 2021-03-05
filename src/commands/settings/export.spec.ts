import { builder, command, handler } from './export';
import Yargs from 'yargs/yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Hub, WorkflowState } from 'dc-management-sdk-js';
import readline from 'readline';
import MockPage from '../../common/dc-management-sdk-js/mock-page';
import { promisify } from 'util';
import { exists, unlink } from 'fs';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('readline');

describe('settings export command', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('should implement an export command', () => {
    expect(command).toEqual('export <dir>');
  });

  describe('builder tests', () => {
    it('should configure yargs', () => {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOption = jest.spyOn(argv, 'option').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('dir', {
        describe: 'Output directory for the exported Settings',
        type: 'string'
      });

      expect(spyOption).toHaveBeenCalledWith('f', {
        type: 'boolean',
        boolean: true,
        describe: 'Overwrite settings without asking.'
      });
    });
  });

  describe('export', () => {
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
    const mockListStates = jest.fn();
    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      hubs: {
        get: mockGetHub
      }
    });

    mockListStates.mockResolvedValue(
      new MockPage(WorkflowState, [
        new WorkflowState({
          id: '5dcc2f0b4cedfd0001d3ef41',
          label: 'new',
          createdBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
          createdDate: '2019-11-13T16:27:55.411Z',
          lastModifiedBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
          lastModifiedDate: '2019-11-13T16:27:55.411Z',
          color: 'rgb(25,195,151)'
        })
      ])
    );

    mockGetHub.mockResolvedValue(
      new Hub({
        id: '5db1727bcff47e0001ce5fd1',
        name: 'amplienceclone1',
        label: 'Amplience Clone 1',
        description: null,
        status: 'ACTIVE',
        settings: {
          virtualStagingEnvironment: {
            hostname: 'lt4678qbqk371h3pz8xszxcvn.staging.bigcontent.io'
          },
          previewVirtualStagingEnvironment: {
            hostname: 'lt4678qbqk371h3pz8xszxcvn.staging.bigcontent.io'
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
                API_KEY: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e93fd',
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
        client: {
          fetchLinkedResource: mockListStates
        },
        _links: {
          'workflow-states': {
            href: 'https://api.amplience.net/v2/content/hubs/5db1727bcff47e0001ce5fd1/workflow-states{?page,size,sort}',
            templated: true
          }
        },
        related: {
          workflowStates: {
            list: mockListStates
          }
        }
      })
    );

    const exportedSettings = {
      id: '5db1727bcff47e0001ce5fd1',
      name: 'amplienceclone1',
      label: 'Amplience Clone 1',
      description: null,
      status: 'ACTIVE',
      settings: {
        virtualStagingEnvironment: {
          hostname: 'lt4678qbqk371h3pz8xszxcvn.staging.bigcontent.io'
        },
        previewVirtualStagingEnvironment: {
          hostname: 'lt4678qbqk371h3pz8xszxcvn.staging.bigcontent.io'
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
              API_KEY: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e93fd',
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
          id: '5dcc2f0b4cedfd0001d3ef41',
          label: 'new',
          createdBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
          createdDate: '2019-11-13T16:27:55.411Z',
          lastModifiedBy: 'dee49f9e-acc0-44c2-bee0-c5e2dbb7e95a',
          lastModifiedDate: '2019-11-13T16:27:55.411Z',
          color: 'rgb(25,195,151)'
        }
      ]
    };

    it('should export settings', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (readline as any).setResponses(['y']);

      const argv = {
        ...yargArgs,
        ...config,
        dir: './'
      };

      await handler(argv);

      const fileExists = await promisify(exists)('./hub-settings-5db1727bcff47e0001ce5fd1-amplienceclone1.json');

      expect(mockGetHub).toHaveBeenCalledTimes(1);
      expect(mockListStates.mock.calls).toMatchSnapshot();
      expect(exportedSettings).toMatchSnapshot();
      expect(fileExists).toBeTruthy();

      await promisify(unlink)('./hub-settings-5db1727bcff47e0001ce5fd1-amplienceclone1.json');
    });
  });
});
