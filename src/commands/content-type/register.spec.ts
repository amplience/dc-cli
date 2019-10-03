import { handler } from './register';
import DataPresenter from '../../view/data-presenter';
import { ContentType } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');
const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter<ContentType>>;

describe('Content type register', () => {
  let mockRegister: jest.Mock;
  let mockGetHub: jest.Mock;

  beforeEach(() => {
    mockRegister = jest.fn();
    mockGetHub = jest.fn().mockResolvedValue({
      related: {
        contentTypes: {
          register: mockRegister
        }
      }
    });
    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      hubs: {
        get: mockGetHub
      }
    });
  });

  it('should register content type with icons and visualization', async () => {
    const yargArgs = {
      $0: 'src/index.ts',
      _: ['content-type', 'register']
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };
    const registerArgs = {
      label: 'test-label',
      schemaId: 'schema-id',
      icons: {
        '0': {
          size: 256,
          url: 'test-url'
        }
      },
      visualizations: {
        '0': {
          label: 'viz-label-1',
          templatedUri: 'viz-test-url-1',
          default: true
        }
      }
    };
    const argv = { ...yargArgs, ...config, ...registerArgs };
    const tableConfig = { columns: { '1': { width: 100 } } };

    const registerResponse = new ContentType({
      contentTypeUri: registerArgs.schemaId,
      settings: {
        label: registerArgs.label,
        icons: [
          {
            size: 256,
            url: 'test-url'
          }
        ],
        visualizations: [
          {
            label: 'viz-label-1',
            templatedUri: 'viz-test-url-1',
            default: true
          }
        ]
      }
    });

    mockRegister.mockResolvedValue(registerResponse);

    await handler(argv);

    expect(mockGetHub).toBeCalledWith('hub-id');
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining(registerResponse.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, registerResponse, tableConfig);
    expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalled();
  });

  it('should register a content type with ordered icon and visualization', async () => {
    const yargArgs = {
      $0: 'src/index.ts',
      _: ['content-type', 'register']
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };
    const registerArgs = {
      label: 'test-label',
      schemaId: 'schema-id',
      icons: {
        '1': {
          size: 512,
          url: 'test-url2'
        },
        '0': {
          size: 256,
          url: 'test-url1'
        }
      },
      visualizations: {
        '1': {
          label: 'viz-label-2',
          templatedUri: 'viz-test-url-2',
          default: false
        },
        '0': {
          label: 'viz-label-1',
          templatedUri: 'viz-test-url-1',
          default: true
        }
      }
    };
    const argv = { ...yargArgs, ...config, ...registerArgs };
    const tableConfig = { columns: { '1': { width: 100 } } };

    const registerResponse = new ContentType({
      contentTypeUri: registerArgs.schemaId,
      settings: {
        label: registerArgs.label,
        icons: [
          {
            size: 256,
            url: 'test-url1'
          },
          {
            size: 512,
            url: 'test-url2'
          }
        ],
        visualizations: [
          {
            label: 'viz-label-1',
            templatedUri: 'viz-test-url-1',
            default: true
          },
          {
            label: 'viz-label-2',
            templatedUri: 'viz-test-url-2',
            default: false
          }
        ]
      }
    });

    mockRegister.mockResolvedValue(registerResponse);

    await handler(argv);

    expect(mockGetHub).toBeCalledWith('hub-id');
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining(registerResponse.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, registerResponse, tableConfig);
    expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalled();
  });
});
