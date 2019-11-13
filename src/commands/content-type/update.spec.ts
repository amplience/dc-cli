import { handler, command, builder } from './update';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType } from 'dc-management-sdk-js';
import DataPresenter, { RenderingOptions } from '../../view/data-presenter';
import Yargs = require('yargs/yargs');

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');

describe('content-type register update', () => {
  it('should implement a register command', () => {
    expect(command).toEqual('update <id>');
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        describe: 'content-type ID',
        type: 'string'
      });
      expect(spyOptions).toHaveBeenCalledWith({
        label: {
          type: 'string',
          describe: 'content-type label'
        },
        icons: {
          describe: 'content-type icons'
        },
        visualizations: {
          describe: 'content-type visualizations'
        },
        cards: {
          describe: 'content-type cards'
        },
        ...RenderingOptions
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
        visualizations: [{ label: 'viz-label', templatedUri: 'https://test-viz-url', default: true }],
        cards: [{ label: 'cards-label', templatedUri: 'https://test-cards-url', default: true }]
      }
    });
    const mockUpdate = jest.fn();
    const mockGetContentType = jest.fn();
    const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter>;

    beforeEach(() => {
      (dynamicContentClientFactory as jest.Mock).mockReturnValue({
        contentTypes: {
          get: mockGetContentType
        }
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
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
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJSON()));
      expect(mockDataPresenter).toHaveBeenCalledWith(mutatedContentType.toJSON());
      expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
    });

    it('should update the content type cards, icons and visualizations', async () => {
      const argv = {
        ...defaultArgv,
        icons: { 0: { size: 256, url: 'https://mutated-test-icon-url' } },
        visualizations: {
          0: { label: 'mutated-viz-label', templatedUri: 'https://mutated-test-viz-url', default: true }
        },
        cards: {
          0: { label: 'mutated-cards-label', templatedUri: 'https://mutated-test-cards-url', default: true }
        }
      };
      const mutatedContentType = new ContentType({
        settings: {
          ...contentType.settings,
          icons: [{ size: 256, url: 'https://mutated-test-icon-url' }],
          visualizations: [{ label: 'mutated-viz-label', templatedUri: 'https://mutated-test-viz-url', default: true }],
          cards: [{ label: 'mutated-cards-label', templatedUri: 'https://mutated-test-cards-url', default: true }]
        }
      });
      mockGetContentType.mockReturnValue(contentType);
      mockUpdate.mockReturnValue(mutatedContentType);
      contentType.related.update = mockUpdate;

      await handler(argv);

      expect(mockGetContentType).toHaveBeenCalledWith('content-type-id');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJSON()));
      expect(mockDataPresenter).toHaveBeenCalledWith(mutatedContentType.toJSON());
      expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
    });

    it('should only only update specified setting', async () => {
      const argv = {
        ...defaultArgv,
        visualizations: {
          0: { label: 'mutated-viz-label', templatedUri: 'https://mutated-test-viz-url', default: true }
        }
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
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJSON()));
      expect(mockDataPresenter).toHaveBeenCalledWith(mutatedContentType.toJSON());
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
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining(mutatedContentType.toJSON()));
      expect(mockDataPresenter).toHaveBeenCalledWith(mutatedContentType.toJSON());
      expect(mockDataPresenter.prototype.render).toHaveBeenCalled();
    });
  });
});
