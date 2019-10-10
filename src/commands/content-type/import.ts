import { Arguments, Argv } from 'yargs';
import { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import * as fs from 'fs';
import path from 'path';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentType, ContentTypeCard, ContentTypeIcon, ContentTypeVisualization } from 'dc-management-sdk-js';
import { transformYargObjectToArray } from '../../common/yargs/yargs-object-transformer';

export const command = 'import [dir]';

export const desc = 'Import Content Types';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Path to Content Type definitions',
      type: 'string',
      demandOption: true
    })
    .options(RenderingOptions);
};

export interface ImportBuilderOptions {
  dir: string;
}

export interface ContentTypeImports {
  contentTypesToCreate:ContentType[],
  contentTypesToUpdate:ContentType[]
}

export const handler = async (
  argv: Arguments<ImportBuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const { dir } = argv;
  const files = await fs.readdirSync(dir);
  console.log('files', files);
  const contentTypes: ContentType[] = files.map(fileName => {
    const file = fs.readFileSync(path.join(dir, fileName), 'utf-8');
    try {
      return JSON.parse(file);
    } catch(e) {
      throw new Error(`Non-JSON file found: ${fileName}, aborting import`);
    }
  });

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const contentTypeList = await paginator(hub.related.contentTypes.list);

  const {contentTypesToCreate, contentTypesToUpdate} = contentTypes.reduce((acc:ContentTypeImports, currentContentType):ContentTypeImports => {
    if (contentTypeList.some(storedContentType => currentContentType.contentTypeUri === storedContentType.contentTypeUri)) {
      acc.contentTypesToUpdate.push(currentContentType)
    } else {
      acc.contentTypesToCreate.push(currentContentType);
    }
    return acc;
  }, {contentTypesToCreate:[], contentTypesToUpdate:[]});
};
