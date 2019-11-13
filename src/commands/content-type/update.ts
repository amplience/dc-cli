import DataPresenter, { RenderingOptions, RenderingArguments } from '../../view/data-presenter';

import { ConfigurationParameters } from '../configure';
import { Arguments, Argv } from 'yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType, ContentTypeVisualization, ContentTypeIcon, ContentTypeCard } from 'dc-management-sdk-js';
import { transformYargObjectToArray, YargObject } from '../../common/yargs/yargs-object-transformer';
import { singleItemTableOptions } from '../../common/table/table.consts';

export const command = 'update <id>';

export const desc = 'Update a Content Type';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe: 'content-type ID'
    })
    .options({
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
};

interface ContentTypeUpdateBuilderOptions {
  id: string;
  label?: string;
  icons?: YargObject<ContentTypeIcon> | boolean;
  cards?: YargObject<ContentTypeCard> | boolean;
  visualizations?: YargObject<ContentTypeVisualization> | boolean;
}

export const handler = async (
  argv: Arguments<ContentTypeUpdateBuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const { id, label, icons, visualizations, cards } = argv;
  const contentType = await client.contentTypes.get(id);
  const mutatedContentType = new ContentType({
    settings: {
      ...contentType.settings,
      ...(label ? { label } : {}),
      ...(icons ? { icons: transformYargObjectToArray<ContentTypeIcon>(icons) } : {}),
      ...(cards ? { cards: transformYargObjectToArray<ContentTypeCard>(cards) } : {}),
      ...(visualizations
        ? {
            visualizations: transformYargObjectToArray<ContentTypeVisualization>(visualizations)
          }
        : {})
    },
    _links: contentType._links
  });
  const updatedContentType = await contentType.related.update(mutatedContentType);

  new DataPresenter(updatedContentType.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
