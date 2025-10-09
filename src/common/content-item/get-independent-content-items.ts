import { ContentItem, ContentRepository } from 'dc-management-sdk-js';
import { ContentMapping } from '../content-mapping';
import { ContentDependancyTree } from './content-dependancy-tree';

export const getIndependentContentItems = (contentItems: ContentItem[]) => {
  const repoContentItems = contentItems.map(content => ({ repo: new ContentRepository(), content }));
  const contentTree = new ContentDependancyTree(repoContentItems, new ContentMapping());
  const independentContentItems = contentTree.all
    .filter(node => {
      let isTopLevel = true;

      contentTree.traverseDependants(
        node,
        dependant => {
          if (dependant != node && contentTree.all.findIndex(entry => entry === dependant) !== -1) {
            isTopLevel = false;
          }
        },
        true
      );

      return isTopLevel;
    })
    .map(node => node.owner.content);

  return independentContentItems;
};
