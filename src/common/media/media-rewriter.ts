import { ContentHub } from '../ch-api/ContentHub';
import { Asset } from '../ch-api/model/Asset';
import { DiSettingsEndpoint } from '../ch-api/model/Settings';
import { ConfigurationParameters } from '../../commands/configure';
import chClientFactory from '../../services/ch-client-factory';
import { RepositoryContentItem } from '../content-item/content-dependancy-tree';
import { MediaLinkInjector } from '../content-item/media-link-injector';

/**
 * Exports media related to given content items from an existing repository.
 * Uses the account credentials to export the media.
 */
export class MediaRewriter {
  private injector: MediaLinkInjector;
  private dam: ContentHub;

  private endpoint: string;
  private defaultHost: string;

  constructor(private config: ConfigurationParameters, private items: RepositoryContentItem[]) {
    this.injector = new MediaLinkInjector(items);
  }

  private escapeForRegex(url: string): string {
    return url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  private connectDam(): void {
    this.dam = chClientFactory(this.config);
  }

  private async getEndpoint(): Promise<void> {
    let endpoint: DiSettingsEndpoint | undefined;
    try {
      const settings = await this.dam.settings.get();

      endpoint = settings.di.endpoints.find(endpoint => {
        return endpoint.id === settings.di.defaultEndpoint;
      });
    } catch (e) {
      throw new Error(`Could not obtain settings from DAM. Make sure you have the required permissions. ${e}`);
    }

    if (endpoint == null) {
      throw new Error('Could not find the default endpoint.');
    }

    this.endpoint = endpoint.path;
    this.defaultHost = endpoint.dynamicHost;
  }

  private async queryAndAdd(query: string, count: number, assets: Map<string, Asset>): Promise<number> {
    const attempts = 3;

    for (let i = 0; i < attempts; i++) {
      try {
        const result = await this.dam.assets.list({
          q: '(' + query + ')',
          n: count
        });

        const items = result.getItems();

        items.forEach(asset => {
          assets.set(asset.name as string, asset);
        });

        return items.length;
      } catch (e) {
        // Retry
      }
    }

    // Too many retries, fail the request.
    throw new Error(`Request for assets failed after ${attempts} attempts.`);
  }

  private getLinkNames(): Set<string> {
    const allNames = new Set<string>();

    const itemLinks = this.injector.all;

    for (let i = 0; i < itemLinks.length; i++) {
      const item = itemLinks[i];

      const links = item.links;
      for (let j = 0; j < links.length; j++) {
        const link = links[j];

        allNames.add(link.link.name);
      }
    }

    return allNames;
  }

  private replaceLinks(assetsByName: Map<string, Asset>): Set<string> {
    const missingAssets = new Set<string>();

    // Replace media link assets with ones that we found with matching names.
    this.injector.all.forEach(links => {
      links.links.forEach(link => {
        const asset = assetsByName.get(link.link.name);
        if (asset != null) {
          link.link.id = asset.id;

          link.link.defaultHost = this.defaultHost;
          link.link.endpoint = this.endpoint;
        } else {
          missingAssets.add(link.link.name);
        }
      });
    });

    return missingAssets;
  }

  async rewrite(): Promise<Set<string>> {
    this.connectDam();

    await this.getEndpoint();

    // Steps:
    // identify existing assets by name (unique, case sensitive)
    //   - content item media dependancies, flush them all into a set
    //   - try do a few batch requests for assets with matching name (arbitrary limit: 3000 characters)
    //   - replace media link assets with ones that we found with matching names
    //   - return non-matching assets

    const allNames = this.getLinkNames();

    if (allNames.size == 0) {
      return new Set<string>();
    }

    const maxQueryLength = 3000;
    const assetsByName = new Map<string, Asset>();
    const names = Array.from(allNames);

    let requestBuilder = 'name:/';
    let first = true;
    let requestCount = 0;

    for (let i = 0; i < allNames.size; i++) {
      const additionalRequest = `${this.escapeForRegex(names[i])}`;

      const lengthSoFar = requestBuilder.length;
      if (first) {
        // First entry?
        requestBuilder += additionalRequest;
        requestCount++;
        first = false;
      } else {
        if (lengthSoFar + 1 + additionalRequest.length < maxQueryLength) {
          // <existing>|<new>
          requestBuilder += '|' + additionalRequest;
          requestCount++;
        } else {
          // If the query is too big, batch out what we have and start over.

          await this.queryAndAdd(requestBuilder + '/', requestCount, assetsByName);
          requestBuilder = 'name:/' + additionalRequest;
        }
      }
    }

    if (requestBuilder.length > 0) {
      await this.queryAndAdd(requestBuilder + '/', requestCount, assetsByName);
    }

    return this.replaceLinks(assetsByName);
  }
}
