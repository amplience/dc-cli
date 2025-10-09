import { ContentItem, DynamicContent } from 'dc-management-sdk-js';

export const getContentByIds = async (client: DynamicContent, ids: string[]) => {
  const contentItems: ContentItem[] = [];

  for (const id of ids) {
    try {
      contentItems.push(await client.contentItems.get(id));
    } catch (e) {
      throw new Error(`Missing content item with id ${id}: ${e.message}`);
    }
  }

  return contentItems;
};
