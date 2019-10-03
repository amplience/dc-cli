import { handler } from './update';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType } from 'dc-management-sdk-js';
import DataPresenter from '../../view/data-presenter';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('Content type register update', () => {
  const yargArgs = {
    $0: 'test',
    _: ['test']
  };
  const config = {
    clientId: 'client-id',
    clientSecret: 'client-id',
    hubId: 'hub-id'
  };
  const defaultArgv = {
    ...yargArgs,
    ...config,
    id: 'content-type-id'
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
  const mockUpdate = jest.fn();
  const mockGetContentType = jest.fn();
  const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter<ContentType>>;

  beforeEach(() => {
    jest.resetAllMocks();
    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      contentTypes: {
        get: mockGetContentType
      }
    });
  });

  it('should update the content type label', async () => {
    const argv = { ...defaultArgv, label: 'mutated-content-type-label' };
    const contentType = new ContentType(contentTypeData);
    const mutatedContentType = new ContentType({
      settings: { ...contentTypeData.settings, label: 'mutated-content-type-label' }
    });
    mockGetContentType.mockReturnValue(contentType);
    mockUpdate.mockReturnValue(mutatedContentType);
    contentType.related.update = mockUpdate;

    await handler(argv);

    expect(mockGetContentType).toHaveBeenCalledWith('content-type-id');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, mutatedContentType, tableConfig);
    expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
  });

  it('should update the content type icons', async () => {
    const argv = {
      ...defaultArgv,
      icons: { 0: { size: 256, url: 'https://test-icon-url' } }
    };
    const contentType = new ContentType(contentTypeData);
    const mutatedContentType = new ContentType({
      settings: { ...contentTypeData.settings, icons: [{ size: 256, url: 'https://test-icon-url' }] }
    });
    mockGetContentType.mockReturnValue(contentType);
    mockUpdate.mockReturnValue(mutatedContentType);
    contentType.related.update = mockUpdate;

    await handler(argv);

    expect(mockGetContentType).toHaveBeenCalledWith('content-type-id');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, mutatedContentType, tableConfig);
    expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
  });

  it('should update the content type visualizations', async () => {
    const argv = {
      ...defaultArgv,
      visualizations: { 0: { label: 'viz-label', templatedUri: 'https://test-viz-url', default: true } }
    };
    const contentType = new ContentType(contentTypeData);
    const mutatedContentType = new ContentType({
      settings: {
        ...contentTypeData.settings,
        visualizations: [{ label: 'viz-label', templatedUri: 'https://test-viz-url', default: true }]
      }
    });
    mockGetContentType.mockReturnValue(contentType);
    mockUpdate.mockReturnValue(mutatedContentType);
    contentType.related.update = mockUpdate;

    await handler(argv);

    expect(mockGetContentType).toHaveBeenCalledWith('content-type-id');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, mutatedContentType, tableConfig);
    expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
  });
});
