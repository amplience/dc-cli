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
  const contentType = new ContentType({
    contentTypeUri: 'https://content-type-uri',
    settings: {
      label: 'content-type-label',
      icons: [{ size: 256, url: 'https://test-icon-url' }],
      visualizations: [{ label: 'viz-label', templatedUri: 'https://test-viz-url', default: true }]
    }
  });
  const mockUpdate = jest.fn();
  const mockGetContentType = jest.fn();
  const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter>;

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
    const mutatedContentType = new ContentType({
      settings: { ...contentType.settings, label: 'mutated-content-type-label' }
    });
    mockGetContentType.mockReturnValue(contentType);
    mockUpdate.mockReturnValue(mutatedContentType);
    contentType.related.update = mockUpdate;

    await handler(argv);

    expect(mockGetContentType).toHaveBeenCalledWith('content-type-id');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(mutatedContentType.toJson());
    expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
  });

  it('should update the content type icons and visualizations', async () => {
    const argv = {
      ...defaultArgv,
      icons: { 0: { size: 256, url: 'https://mutated-test-icon-url' } },
      visualizations: { 0: { label: 'mutated-viz-label', templatedUri: 'https://mutated-test-viz-url', default: true } }
    };
    const mutatedContentType = new ContentType({
      settings: {
        ...contentType.settings,
        icons: [{ size: 256, url: 'https://mutated-test-icon-url' }],
        visualizations: [{ label: 'mutated-viz-label', templatedUri: 'https://mutated-test-viz-url', default: true }]
      }
    });
    mockGetContentType.mockReturnValue(contentType);
    mockUpdate.mockReturnValue(mutatedContentType);
    contentType.related.update = mockUpdate;

    await handler(argv);

    expect(mockGetContentType).toHaveBeenCalledWith('content-type-id');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(mutatedContentType.toJson());
    expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
  });

  it('should only only update specified setting', async () => {
    const argv = {
      ...defaultArgv,
      visualizations: { 0: { label: 'mutated-viz-label', templatedUri: 'https://mutated-test-viz-url', default: true } }
    };

    const mutatedContentType = new ContentType({
      settings: {
        ...contentType.settings,
        visualizations: [{ label: 'mutated-viz-label', templatedUri: 'https://mutated-test-viz-url', default: true }]
      }
    });
    mockGetContentType.mockReturnValue(contentType);
    mockUpdate.mockReturnValue(mutatedContentType);
    contentType.related.update = mockUpdate;

    await handler(argv);

    expect(mockGetContentType).toHaveBeenCalledWith('content-type-id');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(mutatedContentType.toJson());
    expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
  });

  it('should clear setting e.g. only using --visualization with nothing else set', async () => {
    const argv = {
      ...defaultArgv,
      visualizations: true
    };
    const mutatedContentType = new ContentType({
      settings: {
        ...contentType.settings,
        visualizations: []
      }
    });
    mockGetContentType.mockReturnValue(contentType);
    mockUpdate.mockReturnValue(mutatedContentType);
    contentType.related.update = mockUpdate;

    await handler(argv);

    expect(mockGetContentType).toHaveBeenCalledWith('content-type-id');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJson()));
    expect(mockDataPresenter).toHaveBeenCalledWith(mutatedContentType.toJson());
    expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
  });
});
