import DataPresenter, { RenderingOptions, RenderingArguments } from '../../view/data-presenter';
import { CommandOptions } from '../../interfaces/command-options.interface';
import { ConfigurationParameters } from '../configure';
import { Arguments } from 'yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType, ContentTypeVisualization, ContentTypeIcon } from 'dc-management-sdk-js';
import { parseYargObjectToArray, YargObject } from '../../common/yargs/yargs-object-parser';

export const command = 'update';

export const desc = 'Update a Content Type';

export const builder: CommandOptions = {
  id: {
    type: 'string',
    demandOption: true,
    description: 'content-type ID'
  },
  label: {
    type: 'string',
    description: 'Content type label'
  },
  icons: {
    description: 'Content type icons',
    default: {}
  },
  visualizations: {
    description: 'Content type visualizations',
    default: {}
  },
  ...RenderingOptions
};

interface ContentTypeUpdateBuilderOptions {
  id: string;
  label?: string;
  icons?: YargObject<ContentTypeIcon>;
  visualizations?: YargObject<ContentTypeVisualization>;
}

export const handler = async (
  argv: Arguments<ContentTypeUpdateBuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const { id, label, icons, visualizations } = argv;
  const contentType = await client.contentTypes.get(id);
  const mutatedContentType = new ContentType({
    settings: {
      ...contentType.settings,
      ...(label ? { label } : {}),
      ...(icons ? { icons: parseYargObjectToArray<YargObject<ContentTypeIcon>, ContentTypeIcon>(icons) } : {}),
      ...(visualizations
        ? {
            visualizations: parseYargObjectToArray<YargObject<ContentTypeVisualization>, ContentTypeVisualization>(
              visualizations
            )
          }
        : {})
    },
    _links: contentType._links
  });
  const updatedContentType = await contentType.related.update(mutatedContentType);
  const tableOptions = { columns: { 1: { width: 100 } } };

  new DataPresenter(argv, updatedContentType, tableOptions).render();
};
