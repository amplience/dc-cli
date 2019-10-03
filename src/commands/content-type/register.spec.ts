import { handler } from './register';
import DataPresenter from '../../view/data-presenter';
import { ContentType } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { singleItemTableOptions } from '../../common/table/table.consts';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('Content type register', () => {
  const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter>;

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

  describe('handler tests', function() {
    const yargArgs = {
      $0: 'src/index.ts',
      _: ['content-type', 'register'],
      json: true
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    it('should register content type with icons and visualization', async () => {
      const registerArgs = {
        label: 'test-label',
        schemaId: 'schema-id',
        icons: {
          '1': {
            size: 256,
            url: 'test-url-1'
          },
          '0': {
            size: 256,
            url: 'test-url-0'
          },
          '2': {
            size: 256,
            url: 'test-url-2'
          }
        },
        visualizations: {
          '1': {
            label: 'viz-label-1',
            templatedUri: 'viz-test-url-1',
            default: true
          },
          '0': {
            label: 'viz-label-0',
            templatedUri: 'viz-test-url-0',
            default: true
          },
          '2': {
            label: 'viz-label-2',
            templatedUri: 'viz-test-url-2',
            default: true
          }
        }
      };
      const argv = { ...yargArgs, ...config, ...registerArgs };

      const plainContentType = {
        contentTypeUri: registerArgs.schemaId,
        settings: {
          label: registerArgs.label,
          icons: [
            {
              size: 256,
              url: 'test-url-0'
            },
            {
              size: 256,
              url: 'test-url-1'
            },
            {
              size: 256,
              url: 'test-url-2'
            }
          ],
          visualizations: [
            {
              label: 'viz-label-0',
              templatedUri: 'viz-test-url-0',
              default: true
            },
            {
              label: 'viz-label-1',
              templatedUri: 'viz-test-url-1',
              default: true
            },
            {
              label: 'viz-label-2',
              templatedUri: 'viz-test-url-2',
              default: true
            }
          ]
        }
      };
      const registerResponse = new ContentType(plainContentType);

      mockRegister.mockResolvedValue(registerResponse);

      await handler(argv);

      expect(mockGetHub).toBeCalledWith('hub-id');
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining(registerResponse.toJson()));
      expect(mockDataPresenter).toHaveBeenCalledWith(plainContentType);
      expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({
        json: argv.json,
        tableUserConfig: singleItemTableOptions
      });
    });

    it('should register a content type with ordered icon and visualization', async () => {
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

      const plainContentType = {
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
      };
      const registerResponse = new ContentType(plainContentType);

      mockRegister.mockResolvedValue(registerResponse);

      await handler(argv);

      expect(mockGetHub).toBeCalledWith('hub-id');
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining(registerResponse.toJson()));
      expect(mockDataPresenter).toHaveBeenCalledWith(plainContentType);
      expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({
        json: argv.json,
        tableUserConfig: singleItemTableOptions
      });
    });
  });
});
