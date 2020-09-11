import { ContentDependancyTree, RepositoryContentItem, ItemContentDependancies } from './content-dependancy-tree';
import { ContentMapping } from './content-mapping';
import { ContentItem, Status, ContentRepository } from 'dc-management-sdk-js';
import { ItemTemplate } from '../dc-management-sdk-js/mock-content';
import { dependsOn } from '../../commands/content-item/__mocks__/dependant-content-helper';

describe('content-dependancy-tree', () => {
  describe('content dependancy tree tests', () => {
    afterEach((): void => {
      jest.resetAllMocks();
    });

    const itemFromTemplate = (template: ItemTemplate): ContentItem => {
      const item = new ContentItem({
        label: template.label,
        status: template.status || Status.ACTIVE,
        id: template.id || template.label,
        folderId: null,
        version: template.version,
        lastPublishedVersion: template.lastPublishedVersion,
        locale: template.locale,
        body: {
          ...template.body,
          _meta: {
            schema: template.typeSchemaUri
          }
        },

        // Not meant to be here, but used later for sorting by repository
        repoId: template.repoId
      });

      return item;
    };

    const createItems = (items: ItemTemplate[]): RepositoryContentItem[] => {
      const repo = new ContentRepository();

      return items.map(item => ({ repo: repo, content: itemFromTemplate(item) }));
    };

    const expectItemMatch = (items1: ItemContentDependancies[], items2: RepositoryContentItem[]): void => {
      const matchedItems = items1.map(item => item.owner);
      for (let i = 0; i < items2.length; i++) {
        expect(matchedItems).toContain(items2[i]);
      }
    };

    const defaultDependantItems = (): RepositoryContentItem[] => {
      return createItems([
        { label: 'id1', body: dependsOn([]), repoId: 'repo1', typeSchemaUri: 'http://type.com' },
        { label: 'id2', body: dependsOn(['id1']), repoId: 'repo1', typeSchemaUri: 'http://type.com' },
        { label: 'id3', body: dependsOn(['id2']), repoId: 'repo1', typeSchemaUri: 'http://type2.com' },
        { label: 'id4', body: dependsOn(['id1']), repoId: 'repo1', typeSchemaUri: 'http://type2.com' },
        {
          label: 'id5',
          body: dependsOn(['id1', 'id2'], [['exampleProp', 'id2']]),
          repoId: 'repo1',
          typeSchemaUri: 'http://type2.com'
        }
      ]);
    };

    const defaultCircularItems = (): RepositoryContentItem[] => {
      return createItems([
        { label: 'id1', body: dependsOn([]), repoId: 'repo1', typeSchemaUri: 'http://type.com' },
        { label: 'id2', body: dependsOn([]), repoId: 'repo1', typeSchemaUri: 'http://type.com' },
        { label: 'id3', body: dependsOn([]), repoId: 'repo1', typeSchemaUri: 'http://type2.com' },

        { label: 'id4', body: dependsOn(['id5']), repoId: 'repo1', typeSchemaUri: 'http://type.com' },
        { label: 'id5', body: dependsOn(['id4']), repoId: 'repo1', typeSchemaUri: 'http://type2.com' },
        { label: 'id6', body: dependsOn(['id4']), repoId: 'repo1', typeSchemaUri: 'http://type2.com' }
      ]);
    };

    it('should create an empty tree given no content items', () => {
      const tree = new ContentDependancyTree([], new ContentMapping());

      expect(tree.levels.length).toEqual(0);
      expect(tree.circularLinks.length).toEqual(0);
      expect(tree.all.length).toEqual(0);
      expect(tree.byId.size).toEqual(0);
      expect(tree.requiredSchema.length).toEqual(0);
    });

    it('should contain one level when no content dependancies are present', () => {
      const items = createItems([
        { label: 'id1', body: dependsOn([]), repoId: 'repo1', typeSchemaUri: 'http://type.com' },
        { label: 'id2', body: dependsOn([]), repoId: 'repo1', typeSchemaUri: 'http://type.com' },
        { label: 'id3', body: dependsOn([]), repoId: 'repo1', typeSchemaUri: 'http://type2.com' }
      ]);

      const tree = new ContentDependancyTree(items, new ContentMapping());

      expect(tree.levels.length).toEqual(1);
      expect(tree.circularLinks.length).toEqual(0);
      expect(tree.all.length).toEqual(3);
      expect(tree.byId.size).toEqual(3);
      expect(tree.requiredSchema.length).toEqual(2);
    });

    it('should partition content items into levels when dependancies are present, first dependancies then dependants', () => {
      const items = createItems([
        { label: 'id1', body: dependsOn([]), repoId: 'repo1', typeSchemaUri: 'http://type.com' },
        { label: 'id2', body: dependsOn(['id1']), repoId: 'repo1', typeSchemaUri: 'http://type.com' },
        { label: 'id3', body: dependsOn(['id2']), repoId: 'repo1', typeSchemaUri: 'http://type2.com' },
        { label: 'id4', body: dependsOn(['id1']), repoId: 'repo1', typeSchemaUri: 'http://type2.com' },
        { label: 'id5', body: dependsOn(['id2', 'id1']), repoId: 'repo1', typeSchemaUri: 'http://type2.com' }
      ]);

      const tree = new ContentDependancyTree(items, new ContentMapping());

      expect(tree.levels.length).toEqual(3);
      expect(tree.circularLinks.length).toEqual(0);
      expect(tree.all.length).toEqual(5);
      expect(tree.byId.size).toEqual(5);
      expect(tree.requiredSchema.length).toEqual(2);
    });

    it('should partition circular dependancies in their own array, and not in any levels.', () => {
      const items = defaultCircularItems();

      const tree = new ContentDependancyTree(items, new ContentMapping());

      expect(tree.levels.length).toEqual(1);
      expect(tree.circularLinks.length).toEqual(3);
      expect(tree.all.length).toEqual(6);
      expect(tree.byId.size).toEqual(6);
      expect(tree.requiredSchema.length).toEqual(2);
    });

    it('should match cases in dependancies on filter any', () => {
      const items = defaultDependantItems();

      const tree = new ContentDependancyTree(items, new ContentMapping());

      // id3 depends on id1 and id2, which will also be matched.
      const id3Filter = tree.filterAny(item => item.owner.content.id === 'id3');
      expect(id3Filter.length).toEqual(3);

      expectItemMatch(id3Filter, items.slice(0, 3));

      // id4 depends on id1 which will also be matched.
      const id4Filter = tree.filterAny(item => item.owner.content.id === 'id4');
      expect(id4Filter.length).toEqual(2);

      expectItemMatch(id4Filter, [items[0], items[3]]);

      expect(tree.all.length).toEqual(5);
      expect(tree.byId.size).toEqual(5);
    });

    it('should remove content from relevant lists with removeContent', () => {
      const items = defaultDependantItems();

      const tree = new ContentDependancyTree(items, new ContentMapping());

      // 5 items to begin with.
      expect(tree.all.length).toEqual(5);
      expect(tree.levels.reduce((acc, value) => acc + value.items.length, 0)).toEqual(5);
      expect(tree.byId.size).toEqual(5);

      tree.removeContent([tree.all[0], tree.all[2]]);

      // 3 items after removal.

      expectItemMatch(tree.all, [items[1], items[3], items[4]]);

      expect(tree.all.length).toEqual(3);
      expect(tree.levels.reduce((acc, value) => acc + value.items.length, 0)).toEqual(3);
      expect(tree.byId.size).toEqual(3);
    });

    it('should traverse all dependants of an item with traverseDependants, with multiple levels', () => {
      const items = defaultDependantItems();

      const tree = new ContentDependancyTree(items, new ContentMapping());
      const dependants: ItemContentDependancies[] = [];

      // traverse dependants for id2, which is depended on by id3 and id5
      tree.traverseDependants(tree.all[1], item => {
        dependants.push(item);
      });

      expect(dependants.length).toEqual(3);
      expectItemMatch(dependants, [items[1], items[2], items[4]]);

      const dependants2: ItemContentDependancies[] = [];

      // traverse dependants for id1, which is depended on by all content items
      // (sometimes in multiple levels, though they are only traversed once)
      tree.traverseDependants(tree.all[0], item => {
        dependants2.push(item);
      });

      expect(dependants2.length).toEqual(5);
      expectItemMatch(dependants2, items);
    });

    it('should traverse all dependants of an item with traverseDependants ONCE, with circular dependancies', () => {
      const items = defaultCircularItems();

      const tree = new ContentDependancyTree(items, new ContentMapping());

      for (let i = 3; i < 6; i++) {
        // For items 4,5 on the list, picking any one of them will traverse the other two as well.
        // For item 6, there are no _dependants_, so it just returns itself
        const dependants: ItemContentDependancies[] = [];

        tree.traverseDependants(tree.all[i], item => {
          dependants.push(item);
        });

        if (i == 5) {
          expect(dependants.length).toEqual(1);
          expectItemMatch(dependants, [items[5]]);
        } else {
          expect(dependants.length).toEqual(3);
          expectItemMatch(dependants, items.slice(3));
        }
      }
    });

    it('should successfully remove content dependancies', () => {
      const items = defaultDependantItems();

      const tree = new ContentDependancyTree(items, new ContentMapping());

      expect(tree.all[4].dependancies.length).toEqual(3);

      // Remove dependancy for item id2 from id5
      tree.removeContentDependanciesFromBody(
        items[4].content.body,
        tree.all[4].dependancies.filter(dep => dep.dependancy.id === 'id2').map(dep => dep.dependancy)
      );

      // When evaluating the tree with the new content body, the dependancy should be removed.
      // The removal itself does not remove the dependancy from the first tree.
      const tree2 = new ContentDependancyTree(items, new ContentMapping());

      expect(tree2.all[4].dependancies.length).toEqual(1);
    });
  });
});
