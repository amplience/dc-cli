import { Arguments, Argv } from 'yargs';
import { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import * as fs from 'fs';
import path from 'path';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentType } from 'dc-management-sdk-js';
import { differenceWith, intersectionWith } from 'lodash';
import allSettled from 'promise.allsettled';
allSettled.shim();

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

export const extractImportObjects = <T>(dir: string): T[] => {
  const files = fs.readdirSync(dir);
  return files.map(fileName => {
    const file = fs.readFileSync(path.join(dir, fileName), 'utf-8');
    try {
      return JSON.parse(file);
    } catch (e) {
      throw new Error(`Non-JSON file found: ${fileName}, aborting import`);
    }
  });
};

export const handler = async (
  argv: Arguments<ImportBuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const { dir } = argv;
  const importedContentTypes = extractImportObjects<ContentType>(dir);
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedContentTypes = await paginator(hub.related.contentTypes.list);
  const compareContentType = (imported: ContentType, stored: ContentType): boolean =>
    stored.contentTypeUri === imported.contentTypeUri;
  const contentTypesToCreate = differenceWith(importedContentTypes, storedContentTypes, compareContentType);
  const contentTypesToUpdate = intersectionWith(importedContentTypes, storedContentTypes, compareContentType);

  const createResults = [];
  for (const contentType of contentTypesToCreate) {
    createResults.push(await hub.related.contentTypes.register(new ContentType(contentType)));
  }

  const updateResults = [];
  for (const contentType of contentTypesToUpdate) {
    const retrievedContentType = await client.contentTypes.get(contentType.id || '');
    updateResults.push(await retrievedContentType.related.update(contentType));
  }
};
