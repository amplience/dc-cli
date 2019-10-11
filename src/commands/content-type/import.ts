import { Arguments, Argv } from 'yargs';
import { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import * as fs from 'fs';
import path from 'path';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentType } from 'dc-management-sdk-js';
import { differenceBy, intersectionBy } from 'lodash';
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

  const compareContentType = (contentType: ContentType): string | undefined => contentType.contentTypeUri;
  const contentTypesToCreate = differenceBy(importedContentTypes, storedContentTypes, compareContentType);
  const contentTypesToUpdate = intersectionBy(importedContentTypes, storedContentTypes, compareContentType);

  console.log('contentTypesToCreate', contentTypesToCreate);
  console.log('contentTypesToUpdate', contentTypesToUpdate);

  const createPromises = contentTypesToCreate.map(
    (contentType): Promise<ContentType> => hub.related.contentTypes.register(new ContentType(contentType))
  );

  // @ts-ignore only using the shim version work but we have type issue to resolve
  const results = await Promise.allSettled(createPromises);
  console.log('results', results);
  results.forEach((result: any): void => console.log('result', result));
};
