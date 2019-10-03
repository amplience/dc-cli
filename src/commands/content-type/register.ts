import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingOptions, RenderingArguments } from '../../view/data-presenter';
import { Arguments } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentType, ContentTypeIcon, ContentTypeVisualization } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { singleItemTableOptions } from '../../common/table/table.consts';

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

interface IconOption {
  [key: string]: ContentTypeIcon;
}

interface VisualizationOption {
  [key: string]: ContentTypeVisualization;
}

interface ContentTypeBuilderOptions {
  icons: IconOption;
  visualizations: VisualizationOption;
}

function parseSettingsArg<T, U>(objectArg: T): U[] {
  return Object.entries(objectArg)
    .sort((a, b) => (parseInt(a[0], 10) > parseInt(b[0], 10) ? 1 : -1))
    .map(entry => entry[1]);
}

export const handler = async (
  argv: Arguments<ContentTypeBuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const contentType = new ContentType({
    contentTypeUri: argv.schemaId,
    settings: {
      label: argv.label,
      icons: parseSettingsArg<IconOption, ContentTypeIcon>(argv.icons),
      visualizations: parseSettingsArg<VisualizationOption, ContentTypeVisualization>(argv.visualizations)
    }
  });
  const registeredContentType = await hub.related.contentTypes.register(contentType);

  new DataPresenter(registeredContentType.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
