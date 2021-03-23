import { getDefaultLogPath } from '../../common/log-helpers';
import { Argv, Arguments } from 'yargs';
import { join, extname, resolve } from 'path';
import { ConfigurationParameters } from '../configure';
import { lstat, readdir, readFile } from 'fs';
import { promisify } from 'util';

import { ContentItem, ContentRepository } from 'dc-management-sdk-js';
import {
  ContentDependancyTree,
  ItemContentDependancies,
  RepositoryContentItem
} from '../../common/content-item/content-dependancy-tree';
import { ContentMapping } from '../../common/content-item/content-mapping';

export function getTempFolder(name: string, platform: string = process.platform): string {
  return join(process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname, '.amplience', `copy-${name}/`);
}

export const command = 'tree <dir>';

export const desc = 'Print a content dependency tree from content in the given folder.';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('item', 'tree', platform);

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    type: 'string',
    describe: 'Path to the content items to build a tree from.. Should be in the same format as an export.'
  });
};

interface TreeOptions {
  dir: string;
}

const traverseRecursive = async (path: string, action: (path: string) => Promise<void>): Promise<void> => {
  const dir = await promisify(readdir)(path);

  await Promise.all(
    dir.map(async (contained: string) => {
      contained = join(path, contained);
      const stat = await promisify(lstat)(contained);
      return await (stat.isDirectory() ? traverseRecursive(contained, action) : action(contained));
    })
  );
};

const prepareContentForTree = async (
  repos: { basePath: string; repo: ContentRepository }[],
  argv: Arguments<TreeOptions & ConfigurationParameters>
): Promise<ContentDependancyTree | null> => {
  const contentItems: RepositoryContentItem[] = [];
  const schemaNames = new Set<string>();

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i].repo;

    await traverseRecursive(resolve(repos[i].basePath), async path => {
      // Is this valid content? Must have extension .json to be considered, for a start.
      if (extname(path) !== '.json') {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let contentJSON: any;
      try {
        const contentText = await promisify(readFile)(path, { encoding: 'utf8' });
        contentJSON = JSON.parse(contentText);
      } catch (e) {
        console.error(`Couldn't read content item at '${path}': ${e.toString()}`);
        return;
      }

      // Get the folder id via the mapping.

      // Only filter relevant information - for example status and previous content repo are not useful.
      const filteredContent = {
        id: contentJSON.id,
        label: contentJSON.label,
        locale: contentJSON.locale,
        body: contentJSON.body,
        deliveryId: contentJSON.deliveryId == contentJSON.Id || argv.excludeKeys ? undefined : contentJSON.deliveryId,
        folderId: null,
        publish: contentJSON.lastPublishedVersion != null
      };

      if (argv.excludeKeys) {
        delete filteredContent.body._meta.deliveryKey;
      }

      schemaNames.add(contentJSON.body._meta.schema);

      contentItems.push({ repo: repo, content: new ContentItem(filteredContent) });
    });
  }

  return new ContentDependancyTree(contentItems, new ContentMapping());
};

export const handler = async (argv: Arguments<TreeOptions & ConfigurationParameters>): Promise<void> => {
  const dir = argv.dir;

  const baseDirContents = await promisify(readdir)(dir);
  const importRepos: { basePath: string; repo: ContentRepository }[] = [];
  for (let i = 0; i < baseDirContents.length; i++) {
    const name = baseDirContents[i];
    const path = join(dir, name);
    const status = await promisify(lstat)(path);
    if (status.isDirectory()) {
      importRepos.push({ basePath: path, repo: new ContentRepository() });
    }
  }

  const tree = await prepareContentForTree(importRepos, argv);

  // Print the items in the tree.
  // Keep a set of all items that have already been printed.
  // Starting at the highest level, print all dependencies on the tree.

  if (tree == null) return;

  const evaluated = new Set<ItemContentDependancies>();
  const firstSecondThird = (index: number, total: number): number => {
    return index === 0 ? 0 : index == total - 1 ? 2 : 1;
  };

  const fstPipes = ['├', '├', '└'];

  const printDependency = (
    item: ItemContentDependancies,
    depth: number,
    evalThis: ItemContentDependancies[],
    fst: number,
    prefix: string
  ): boolean => {
    const pipe = depth < 0 ? '' : fstPipes[fst] + '─ ';

    if (evalThis.indexOf(item) !== -1) {
      console.log(`${prefix}${pipe}*** (${item.owner.content.label})`);
      return false;
    } else if (evaluated.has(item)) {
      if (depth > 0) {
        console.log(`${prefix}${pipe}(${item.owner.content.label})`);
      }
      return false;
    } else {
      console.log(`${prefix}${pipe}${item.owner.content.label}`);
    }

    evalThis.push(item);
    evaluated.add(item);

    item.dependancies.forEach((dep, index) => {
      if (dep.resolved) {
        const subFst = firstSecondThird(index, item.dependancies.length);
        const subPrefix = depth == -1 ? '' : fst === 2 ? '   ' : '│  ';
        printDependency(dep.resolved, depth + 1, [...evalThis], subFst, prefix + subPrefix);
      }
    });
    return true;
  };

  for (let i = tree.levels.length - 1; i >= 0; i--) {
    const level = tree.levels[i];
    console.log(`=== LEVEL ${i + 1} (${level.items.length}) ===`);

    level.items.forEach(item => {
      printDependency(item, -1, [], 0, '');
      console.log('');
    });
  }

  console.log(`=== CIRCULAR (${tree.circularLinks.length}) ===`);
  let topLevelPrints = 0;
  tree.circularLinks.forEach(item => {
    if (printDependency(item, -1, [], 0, '')) {
      topLevelPrints++;
      console.log('');
    }
  });

  console.log(`Finished. Circular Dependencies printed: ${topLevelPrints}`);
};
