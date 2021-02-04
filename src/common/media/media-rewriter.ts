import { Asset, DAM } from 'dam-management-sdk-js';
import { DiSettingsEndpoint } from 'dam-management-sdk-js/build/main/lib/model/Settings';
import { ConfigurationParameters } from '../../commands/configure';
import damClientFactory from '../../services/dam-client-factory';
import { RepositoryContentItem } from '../content-item/content-dependancy-tree';
import { MediaLinkInjector } from '../content-item/media-link-injector';

/**
 * Exports media related to given content items from an existing repository.
 * Uses the account credentials to export the media.
 */
export class MediaRewriter {
  private injector: MediaLinkInjector;
  private dam: DAM;

  private endpoint: string;
  private defaultHost: string;

  constructor(private config: ConfigurationParameters, private items: RepositoryContentItem[]) {
    this.injector = new MediaLinkInjector(items);
  }

  private escapeForRegex(url: string): string {
    return url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  private connectDam(): void {
    this.dam = damClientFactory(this.config);
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

  async rewrite(): Promise<Set<string>> {
    this.connectDam();

    await this.getEndpoint();

    // Steps:
    // identify existing assets by name (unique, case sensitive)
    //   - content item media dependancies, flush them all into a set
    //   - try do a few batch requests for assets with matching name (arbitrary limit: 3000 characters)
    //   - replace media link assets with ones that we found with matching names
    //   - return non-matching assets

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

    const missingAssets = new Set<string>();

    if (allNames.size == 0) {
      return missingAssets;
    }

    const assetsByName = new Map<string, Asset>();
    const names = Array.from(allNames);

    let requestBuilder = 'name:/';
    let requestCount = 0;
    let totalFound = 0;

    for (let i = 0; i < allNames.size; i++) {
      const additionalRequest = `${this.escapeForRegex(names[i])}`;

      const lengthSoFar = requestBuilder.length;
      if (lengthSoFar == 6) {
        // First entry?
        requestBuilder += additionalRequest;
        requestCount++;
      } else {
        if (lengthSoFar + 4 + additionalRequest.length < 3000) {
          // <existing> OR <new>
          requestBuilder += '|' + additionalRequest;
          requestCount++;
        } else {
          // If the query is too big, batch out what we have and start over.

          totalFound += await this.queryAndAdd(requestBuilder + '/', requestCount, assetsByName);
          requestBuilder = 'name:/' + additionalRequest;
        }
      }
    }

    if (requestBuilder.length > 0) {
      totalFound += await this.queryAndAdd(requestBuilder + '/', requestCount, assetsByName);
    }

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
}
