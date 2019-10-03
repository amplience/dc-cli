import DataPresenter, { RenderingOptions, RenderingArguments } from '../../view/data-presenter';
import { CommandOptions } from '../../interfaces/command-options.interface';
import { ConfigurationParameters } from '../configure';
import { Arguments } from 'yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType, ContentTypeVisualization, ContentTypeIcon } from 'dc-management-sdk-js';
import { transformYargObjectToArray, YargObject } from '../../common/yargs/yargs-object-transformer';

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
    description: 'Content type icons'
  },
  visualizations: {
    description: 'Content type visualizations'
  },
  ...RenderingOptions
};

interface ContentTypeUpdateBuilderOptions {
  id: string;
  label?: string;
  icons?: YargObject<ContentTypeIcon> | boolean;
  visualizations?: YargObject<ContentTypeVisualization> | boolean;
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
      ...(icons ? { icons: transformYargObjectToArray<ContentTypeIcon>(icons) } : {}),
      ...(visualizations
        ? {
            visualizations: transformYargObjectToArray<ContentTypeVisualization>(visualizations)
          }
        : {})
    },
    _links: contentType._links
  });
  console.log(argv);
  const updatedContentType = await contentType.related.update(mutatedContentType);
  const tableOptions = { columns: { 1: { width: 100 } } };

  new DataPresenter(argv, updatedContentType, tableOptions).render();
};
