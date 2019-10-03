import { handler } from './update';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType } from 'dc-management-sdk-js';
import DataPresenter from '../../view/data-presenter';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter<ContentType>>;

describe('Content type register update', () => {
  let mockGetContentType: jest.Mock;

  beforeEach(() => {
    mockGetContentType = jest.fn();
    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      contentTypes: {
        get: mockGetContentType
      }
    });
  });
  it('should update the content type label', async () => {
    const yargArgs = {
      $0: 'test',
      _: ['test']
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };
    const argv = { ...yargArgs, ...config, id: 'content-type-id', label: 'mutated-content-type-label' };
    const contentTypeData = {
      contentTypeUri: 'https://content-type-uri',
      settings: {
        label: 'content-type-label',
        icons: [],
        visualiazations: []
      }
    };
    const tableConfig = { columns: { '1': { width: 100 } } };
    const contentType = new ContentType(contentTypeData);
    const mutatedContentType = new ContentType({
      settings: { ...contentTypeData.settings, label: 'mutated-content-type-label' }
    });
    const mockUpdate = jest.fn().mockReturnValue(mutatedContentType);
    contentType.related.update = mockUpdate;
    mockGetContentType.mockReturnValue(contentType);

    await handler(argv);

    expect(mockGetContentType).toHaveBeenCalledWith('content-type-id');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, mutatedContentType, tableConfig);
    expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
  });

  it('should update the content type icons', async () => {
    const yargArgs = {
      $0: 'test',
      _: ['test']
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };
    const argv = {
      ...yargArgs,
      ...config,
      id: 'content-type-id',
      icons: { 0: { size: 256, url: 'https://test-icon-url' } }
    };
    const contentTypeData = {
      contentTypeUri: 'https://content-type-uri',
      settings: {
        label: 'content-type-label',
        icons: [],
        visualizations: []
      }
    };
    const tableConfig = { columns: { '1': { width: 100 } } };
    const contentType = new ContentType(contentTypeData);
    const mutatedContentType = new ContentType({
      settings: { ...contentTypeData.settings, icons: [{ size: 256, url: 'https://test-icon-url' }] }
    });
    const mockUpdate = jest.fn().mockReturnValue(mutatedContentType);
    contentType.related.update = mockUpdate;
    mockGetContentType.mockReturnValue(contentType);

    await handler(argv);

    expect(mockGetContentType).toHaveBeenCalledWith('content-type-id');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, mutatedContentType, tableConfig);
    expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
  });

  it('should update the content type visualizations', async () => {
    const yargArgs = {
      $0: 'test',
      _: ['test']
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };
    const argv = {
      ...yargArgs,
      ...config,
      id: 'content-type-id',
      visualizations: { 0: { label: 'viz-label', templatedUri: 'https://test-viz-url', default: true } }
    };
    const contentTypeData = {
      contentTypeUri: 'https://content-type-uri',
      settings: {
        label: 'content-type-label',
        icons: [],
        visualizations: []
      }
    };
    const tableConfig = { columns: { '1': { width: 100 } } };
    const contentType = new ContentType(contentTypeData);
    const mutatedContentType = new ContentType({
      settings: {
        ...contentTypeData.settings,
        visualizations: [{ label: 'viz-label', templatedUri: 'https://test-viz-url', default: true }]
      }
    });
    const mockUpdate = jest.fn().mockReturnValue(mutatedContentType);
    contentType.related.update = mockUpdate;
    mockGetContentType.mockReturnValue(contentType);

    await handler(argv);

    expect(mockGetContentType).toHaveBeenCalledWith('content-type-id');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, mutatedContentType, tableConfig);
    expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
  });
});
