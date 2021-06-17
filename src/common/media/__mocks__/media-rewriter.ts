import { ConfigurationParameters } from '../../../commands/configure';
import { RepositoryContentItem } from '../../content-item/content-dependancy-tree';

export class MediaRewriter {
  static rewrites = 0;

  constructor(private config: ConfigurationParameters, private items: RepositoryContentItem[]) {}

  async rewrite(): Promise<Set<string>> {
    MediaRewriter.rewrites++;

    return new Set<string>();
  }
}
