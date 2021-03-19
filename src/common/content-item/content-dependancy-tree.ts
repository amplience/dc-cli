import { ContentItem, ContentRepository } from 'dc-management-sdk-js';
import { ContentMapping } from './content-mapping';
import { Body } from './body';

type DependancyContentTypeSchema =
  | 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link'
  | 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-reference'
  | '_hierarchy'; // Used internally for parent dependancies.

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
  dependants: ContentDependancyInfo[];
}

export interface ContentDependancyLayer {
  items: ItemContentDependancies[];
}

export const referenceTypes = [
  'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link',
  'http://bigcontent.io/cms/schema/v1/core#/definitions/content-reference'
];

type RecursiveSearchStep = Body | ContentDependancy | Array<Body>;

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
          stage.push(item);
          return false;
        }

        return true;
      });

      stage.forEach(item => {
        resolved.add(item.owner.content.id as string);
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

  private searchObjectForContentDependancies(
    item: RepositoryContentItem,
    body: RecursiveSearchStep,
    result: ContentDependancyInfo[]
  ): void {
    if (Array.isArray(body)) {
      body.forEach(contained => {
        this.searchObjectForContentDependancies(item, contained, result);
      });
    } else if (body != null) {
      const allPropertyNames = Object.getOwnPropertyNames(body);
      // Does this object match the pattern expected for a content item or reference?
      if (
        body._meta &&
        referenceTypes.indexOf(body._meta.schema) !== -1 &&
        typeof body.contentType === 'string' &&
        typeof body.id === 'string'
      ) {
        result.push({ dependancy: body as ContentDependancy, owner: item });
        return;
      }

      allPropertyNames.forEach(propName => {
        const prop = (body as Body)[propName];
        if (typeof prop === 'object') {
          this.searchObjectForContentDependancies(item, prop, result);
        }
      });
    }
  }

  public removeContentDependanciesFromBody(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any,
    remove: object[]
  ): void {
    if (Array.isArray(body)) {
      for (let i = 0; i < body.length; i++) {
        if (remove.indexOf(body[i]) !== -1) {
          body.splice(i--, 1);
        } else {
          this.removeContentDependanciesFromBody(body[i], remove);
        }
      }
    } else {
      const allPropertyNames = Object.getOwnPropertyNames(body);

      allPropertyNames.forEach(propName => {
        const prop = body[propName];
        if (remove.indexOf(prop) !== -1) {
          delete body[propName];
        } else if (typeof prop === 'object') {
          this.removeContentDependanciesFromBody(prop, remove);
        }
      });
    }
  }

  private identifyContentDependancies(items: RepositoryContentItem[]): ItemContentDependancies[] {
    return items.map(item => {
      const result: ContentDependancyInfo[] = [];
      this.searchObjectForContentDependancies(item, item.content.body, result);

      // Hierarchy parent is also a dependancy.
      if (item.content.body._meta.hierarchy && item.content.body._meta.hierarchy.parentId) {
        result.push({
          dependancy: {
            _meta: {
              schema: '_hierarchy'
            },
            id: item.content.body._meta.hierarchy.parentId,
            contentType: ''
          },
          owner: item
        });
      }

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
          target.dependants.push({ owner: target.owner, resolved: item, dependancy: dep.dependancy });
          resolve(target);
        }
      });
    };

    items.forEach(item => resolve(item));
  }

  public traverseDependants(
    item: ItemContentDependancies,
    action: (item: ItemContentDependancies) => void,
    ignoreHier = false,
    traversed?: Set<ItemContentDependancies>
  ): void {
    const traversedSet = traversed || new Set<ItemContentDependancies>();
    traversedSet.add(item);
    action(item);
    item.dependants.forEach(dependant => {
      if (ignoreHier && dependant.dependancy._meta.schema == '_hierarchy') {
        return;
      }

      const resolved = dependant.resolved as ItemContentDependancies;
      if (!traversedSet.has(resolved)) {
        this.traverseDependants(resolved, action, ignoreHier, traversedSet);
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

  public removeContent(items: ItemContentDependancies[]): void {
    this.levels.forEach(level => {
      level.items = level.items.filter(item => items.indexOf(item) === -1);
    });

    this.all = this.all.filter(item => items.indexOf(item) === -1);
    this.circularLinks = this.circularLinks.filter(item => items.indexOf(item) === -1);

    items.forEach(item => {
      this.byId.delete(item.owner.content.id as string);
    });
  }
}
