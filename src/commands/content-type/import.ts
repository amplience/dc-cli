import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import * as fs from 'fs';
import path from 'path';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { ContentType } from 'dc-management-sdk-js';
import { differenceBy, intersectionBy } from 'lodash';
import { itemMapFn } from './list';
import allSettled, { PromiseResult } from 'promise.allsettled';
import { PromiseResolution } from 'promise.allsettled/types';
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

export const extractImportObjects = <T>(dir: string, MyClass: new (t: T) => T): T[] => {
  const files = fs.readdirSync(dir);
  return files.map(fileName => {
    const file = fs.readFileSync(path.join(dir, fileName), 'utf-8');
    try {
      return new MyClass(JSON.parse(file));
    } catch (e) {
      throw new Error(`Non-JSON file found: ${fileName}, aborting import`);
    }
  });
};

export const handler = async (
  argv: Arguments<ImportBuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const { dir } = argv;
  const importedContentTypes = extractImportObjects<ContentType>(dir, ContentType);

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const storedContentTypes = await paginator(hub.related.contentTypes.list);

  const compareContentType = (contentType: ContentType) => contentType.contentTypeUri;
  const contentTypesToCreate = differenceBy(importedContentTypes, storedContentTypes, compareContentType);
  const contentTypesToUpdate = intersectionBy(importedContentTypes, storedContentTypes, compareContentType);

  console.log('contentTypesToCreate', contentTypesToCreate);
  console.log('contentTypesToUpdate', contentTypesToUpdate);

  const createPromises = contentTypesToCreate.map(
    (contentType): Promise<ContentType> => {
      return hub.related.contentTypes.register(contentType);
    }
  );
  const results = await allSettled(createPromises);
  // new DataPresenter(
  //   results.map(value => {
  //     // if (value.status === 'fulfilled') {
  //     //   return (value as PromiseResolution<ContentType>).value.toJson();
  //     // }
  //   })
  // ).render({
  //   json: argv.json,
  //   itemMapFn: itemMapFn
  // });
  console.log(results);
};
