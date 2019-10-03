import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingOptions, RenderingArguments } from '../../view/data-presenter';
import { Arguments } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentType, ContentTypeIcon, ContentTypeVisualization } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { transformYargObjectToArray, YargObject } from '../../common/yargs/yargs-object-transformer';

export const command = 'register';

export const desc = 'Register a Content Type';

export const builder: CommandOptions = {
  schemaId: {
    type: 'string',
    demandOption: true,
    description: 'content-type-schema ID'
  },
  label: {
    type: 'string',
    demandOption: true,
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

interface ContentTypeBuilderOptions {
  icons: YargObject<ContentTypeIcon>;
  visualizations: YargObject<ContentTypeVisualization>;
}

export const handler = async (
  argv: Arguments<ContentTypeBuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const { hubId, schemaId, label, icons, visualizations } = argv;
  const hub = await client.hubs.get(hubId);
  const contentType = new ContentType({
    contentTypeUri: schemaId,
    settings: {
      label: label,
      icons: transformYargObjectToArray<ContentTypeIcon>(icons),
      visualizations: transformYargObjectToArray<ContentTypeVisualization>(visualizations)
    }
  });
  const registeredContentType = await hub.related.contentTypes.register(contentType);
  const tableOptions = {
    columns: {
      1: {
        width: 100
      }
    }
  };

  new DataPresenter(argv, registeredContentType, tableOptions).render();
};
