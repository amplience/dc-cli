import { RepositoryContentItem } from './content-dependancy-tree';
import { Body } from './body';

export interface MediaLink {
  id: string;
  name: string;
  endpoint: string;
  defaultHost: string;
  mediaType: string;
  _meta: {
    schema:
      | 'http://bigcontent.io/cms/schema/v1/core#/definitions/image-link'
      | 'http://bigcontent.io/cms/schema/v1/core#/definitions/video-link';
  };
}

export interface MediaLinkInfo {
  link: MediaLink;
  owner: RepositoryContentItem;
}

export interface ItemMediaLinks {
  owner: RepositoryContentItem;
  links: MediaLinkInfo[];
}

export const linkTypes = [
  'http://bigcontent.io/cms/schema/v1/core#/definitions/image-link',
  'http://bigcontent.io/cms/schema/v1/core#/definitions/video-link'
];

type RecursiveSearchStep = Body | MediaLink | Array<Body>;

export class MediaLinkInjector {
  all: ItemMediaLinks[];

  constructor(items: RepositoryContentItem[]) {
    // Identify all content dependancies.
    this.all = this.identifyMediaLinks(items);
  }

  private searchObjectForMediaLinks(
    item: RepositoryContentItem,
    body: RecursiveSearchStep,
    result: MediaLinkInfo[]
  ): void {
    if (Array.isArray(body)) {
      body.forEach(contained => {
        this.searchObjectForMediaLinks(item, contained, result);
      });
    } else {
      const allPropertyNames = Object.getOwnPropertyNames(body);
      // Does this object match the pattern expected for a content item or reference?
      if (
        body._meta &&
        linkTypes.indexOf(body._meta.schema) !== -1 &&
        typeof body.name === 'string' &&
        typeof body.id === 'string'
      ) {
        result.push({ link: body as MediaLink, owner: item });
        return;
      }

      allPropertyNames.forEach(propName => {
        const prop = (body as Body)[propName];
        if (typeof prop === 'object') {
          this.searchObjectForMediaLinks(item, prop, result);
        }
      });
    }
  }

  private identifyMediaLinks(items: RepositoryContentItem[]): ItemMediaLinks[] {
    return items.map(item => {
      const result: MediaLinkInfo[] = [];
      this.searchObjectForMediaLinks(item, item.content.body, result);
      return { owner: item, links: result };
    });
  }
}
