import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingOptions, RenderingArguments } from '../../view/data-presenter';
import { Arguments } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ContentType, ContentTypeIcon, ContentTypeVisualization, ContentTypeCard } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { transformYargObjectToArray, YargObject } from '../../common/yargs/yargs-object-transformer';
import { singleItemTableOptions } from '../../common/table/table.consts';

export const command = 'register';

export const desc = 'Register a Content Type';

export const builder: CommandOptions = {
  schemaId: {
    type: 'string',
    demandOption: true,
    describe: 'content-type-schema ID',
    requiresArg: true
  },
  label: {
    type: 'string',
    demandOption: true,
    describe: 'content-type label',
    requiresArg: true
  },
  icons: {
    describe: 'content-type icons',
    default: {}
  },
  visualizations: {
    describe: 'content-type visualizations',
    default: {}
  },
  cards: {
    describe: 'content-type cards',
    default: {}
  },
  ...RenderingOptions
};

interface ContentTypeBuilderOptions {
  icons: YargObject<ContentTypeIcon>;
  visualizations: YargObject<ContentTypeVisualization>;
  cards: YargObject<ContentTypeCard>;
}

export const handler = async (
  argv: Arguments<ContentTypeBuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const { hubId, schemaId, label, icons, visualizations, cards } = argv;
  const hub = await client.hubs.get(hubId);
  const contentType = new ContentType({
    contentTypeUri: schemaId,
    settings: {
      label: label,
      icons: transformYargObjectToArray<ContentTypeIcon>(icons),
      visualizations: transformYargObjectToArray<ContentTypeVisualization>(visualizations),
      cards: transformYargObjectToArray<ContentTypeCard>(cards)
    }
  });
  const registeredContentType = await hub.related.contentTypes.register(contentType);

  new DataPresenter(registeredContentType.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
