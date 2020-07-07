import { ContentItem, ContentRepository } from 'dc-management-sdk-js';
import { ContentMapping } from './content-mapping';

type DependancyContentTypeSchema =
  | 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link'
  | 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-reference';

export interface RepositoryContentItem {
  repo: ContentRepository;
  content: ContentItem;
}

export interface ContentDependancy {
  _meta: { schema: DependancyContentTypeSchema };
  contentType: string;
  id: string | undefined;
}

export interface ContentDependancyInfo {
  resolved?: ItemContentDependancies;
  dependancy: ContentDependancy;
  owner: RepositoryContentItem;
}

export interface ItemContentDependancies {
  owner: RepositoryContentItem;
  dependancies: ContentDependancyInfo[];
  dependants: ItemContentDependancies[];
}

export interface ContentDependancyLayer {
  items: ItemContentDependancies[];
}

export const referenceTypes = [
  'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link',
  'http://bigcontent.io/cms/schema/v1/core#/definitions/content-reference'
];

export class ContentDependancyTree {
  levels: ContentDependancyLayer[];
  circularLinks: ItemContentDependancies[];
  all: ItemContentDependancies[];
  byId: Map<string, ItemContentDependancies>;
  requiredSchema: string[];

  constructor(items: RepositoryContentItem[], mapping: ContentMapping) {
    // Identify all content dependancies.
    let info = this.identifyContentDependancies(items);
    const allInfo = info;
    this.resolveContentDependancies(info);

    const requiredSchema = new Set<string>();
    info.forEach(item => {
      requiredSchema.add(item.owner.content.body._meta.schema);
    });

    // For each stage, add all content that has no dependancies resolved in a previous stage
    const resolved = new Set<string>();
    mapping.contentItems.forEach((to, from) => {
      resolved.add(from);
    });

    let unresolvedCount = info.length;

    const stages: ContentDependancyLayer[] = [];
    while (unresolvedCount > 0) {
      const stage: ItemContentDependancies[] = [];
      const lastUnresolvedCount = unresolvedCount;
      info = info.filter(item => {
        const unresolvedDependancies = item.dependancies.filter(dep => !resolved.has(dep.dependancy.id as string));

        if (unresolvedDependancies.length === 0) {
          resolved.add(item.owner.content.id as string);
          stage.push(item);
          return false;
        }

        return true;
      });

      unresolvedCount = info.length;
      if (unresolvedCount === lastUnresolvedCount) {
        break;
      }

      stages.push({ items: stage });
    }

    // Remaining items in the info array are connected to circular dependancies, so must be resolved via rewriting.

    this.levels = stages;
    this.circularLinks = info;
    this.all = allInfo;
    this.byId = new Map(allInfo.map(info => [info.owner.content.id as string, info]));
    this.requiredSchema = Array.from(requiredSchema);
  }

  public searchObjectForContentDependancies(
    item: RepositoryContentItem,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any,
    result: ContentDependancyInfo[]
  ): void {
    if (Array.isArray(body)) {
      body.forEach(contained => {
        this.searchObjectForContentDependancies(item, contained, result);
      });
    } else {
      const allPropertyNames = Object.getOwnPropertyNames(body);
      // Does this object match the pattern expected for a content item or reference?
      if (
        body._meta &&
        referenceTypes.indexOf(body._meta.schema) !== -1 &&
        typeof body.contentType === 'string' &&
        typeof body.id === 'string'
      ) {
        result.push({ dependancy: body, owner: item });
        return;
      }

      allPropertyNames.forEach(propName => {
        const prop = body[propName];
        if (typeof prop === 'object') {
          this.searchObjectForContentDependancies(item, prop, result);
        }
      });
    }
  }

  private identifyContentDependancies(items: RepositoryContentItem[]): ItemContentDependancies[] {
    return items.map(item => {
      const result: ContentDependancyInfo[] = [];
      this.searchObjectForContentDependancies(item, item.content.body, result);
      return { owner: item, dependancies: result, dependants: [] };
    });
  }

  private resolveContentDependancies(items: ItemContentDependancies[]): void {
    // Create cross references to make it easier to traverse dependancies.

    const idMap = new Map(items.map(item => [item.owner.content.id as string, item]));
    const visited = new Set<ItemContentDependancies>();

    const resolve = (item: ItemContentDependancies): void => {
      if (visited.has(item)) return;
      visited.add(item);

      item.dependancies.forEach(dep => {
        const target = idMap.get(dep.dependancy.id as string);
        dep.resolved = target;
        if (target) {
          target.dependants.push(item);
          resolve(target);
        }
      });
    };

    items.forEach(item => resolve(item));
  }

  public traverseDependants(
    item: ItemContentDependancies,
    action: (item: ItemContentDependancies) => void,
    traversed?: Set<ItemContentDependancies>
  ): void {
    const traversedSet = traversed || new Set<ItemContentDependancies>();
    traversedSet.add(item);
    action(item);
    item.dependants.forEach(dependant => {
      if (!traversedSet.has(dependant)) {
        this.traverseDependants(dependant, action, traversedSet);
      }
    });
  }

  public filterAny(action: (item: ItemContentDependancies) => boolean): ItemContentDependancies[] {
    return this.all.filter(item => {
      let match = false;
      this.traverseDependants(item, item => {
        if (action(item)) {
          match = true;
        }
      });
      return match;
    });
  }

  removeContent = (items: ItemContentDependancies[]): void => {
    this.levels.forEach(level => {
      level.items = level.items.filter(item => items.indexOf(item) === -1);
    });

    this.all = this.all.filter(item => items.indexOf(item) === -1);
    this.circularLinks = this.circularLinks.filter(item => items.indexOf(item) === -1);
  };
}
