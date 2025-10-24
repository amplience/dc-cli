import { ContentItem, DynamicContent } from 'dc-management-sdk-js';

export const getContentByIds = async (client: DynamicContent, ids: string[]): Promise<ContentItem[]> => {
  const contentItems: ContentItem[] = [];

  for (const id of ids) {
    try {
      contentItems.push(await client.contentItems.get(id));
    } catch (e) {
      // Silently fail missing content items
    }
  }

  return contentItems;
};
