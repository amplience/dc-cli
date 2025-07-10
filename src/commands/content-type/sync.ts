import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentType, ContentTypeCachedSchema } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../configure';
import BuilderOptions from '../../interfaces/builder-options';
import { singleItemTableOptions } from '../../common/table/table.consts';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { extractSortable, PagingParameters } from '../../common/yargs/sorting-options';
import { progressBar } from '../../common/progress-bar/progress-bar';

export const command = 'sync [id]';

export const desc = 'Sync Content Type with the schema';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Content Type ID',
      type: 'string'
    })
    .options(RenderingOptions);
};

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments & PagingParameters>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  if (!argv.id) {
    const hub = await client.hubs.get(argv.hubId);
    const contentTypeList = await paginator(hub.related.contentTypes.list, extractSortable(argv));
    const updatedContentTypeSchemas: ContentTypeCachedSchema[] = [];

    if (contentTypeList.length === 0) {
      console.log('No content types found to sync, aborting.');
      return;
    }

    const progress = progressBar(contentTypeList.length, 0, {
      title: `Syncing ${contentTypeList.length} content types`
    });

    try {
      for (const contentType of contentTypeList) {
        const updatedContentTypeSchema = await contentType.related.contentTypeSchema.update();
        updatedContentTypeSchemas.push(updatedContentTypeSchema);
        progress.increment();
      }
    } catch (e) {
      throw e;
    } finally {
      progress.stop();
    }

    new DataPresenter(updatedContentTypeSchemas.map(v => v.toJSON())).render({
      json: argv.json,
      itemMapFn
    });

    return;
  }

  const contentType: ContentType = await client.contentTypes.get(argv.id);
  const contentTypeCachedSchema: ContentTypeCachedSchema = await contentType.related.contentTypeSchema.update();
  new DataPresenter(contentTypeCachedSchema.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};

export const itemMapFn = ({ hubId, contentTypeUri }: ContentTypeCachedSchema): object => ({
  hubId,
  contentTypeUri
});
