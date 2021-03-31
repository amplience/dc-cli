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

type CircularLink = [number, number];
interface ParentReference {
  item: ItemContentDependancies;
  line: number;
}

const firstSecondThird = (index: number, total: number): number => {
  return index === 0 ? 0 : index == total - 1 ? 2 : 1;
};

const fstPipes = ['├', '├', '└'];
const circularPipes = ['╗', '║', '╝'];
const circularLine = '═';

const printDependency = (
  item: ItemContentDependancies,
  evaluated: Set<ItemContentDependancies>,
  lines: string[],
  circularLinks: CircularLink[],
  evalThis: ParentReference[],
  fst: number,
  prefix: string
): boolean => {
  const depth = evalThis.length - 1;
  const pipe = depth < 0 ? '' : fstPipes[fst] + '─ ';

  const circularMatch = evalThis.find(parent => parent.item == item);
  if (circularMatch) {
    lines.push(`${prefix}${pipe}*** (${item.owner.content.label})`);
    circularLinks.push([circularMatch.line, lines.length - 1]);
    return false;
  } else if (evaluated.has(item)) {
    if (depth > -1) {
      lines.push(`${prefix}${pipe}(${item.owner.content.label})`);
    }
    return false;
  } else {
    lines.push(`${prefix}${pipe}${item.owner.content.label}`);
  }

  evalThis.push({ item, line: lines.length - 1 });
  evaluated.add(item);

  const filteredItems = item.dependancies.filter(dep => dep.resolved);
  filteredItems.forEach((dep, index) => {
    if (dep.resolved) {
      const subFst = firstSecondThird(index, filteredItems.length);
      const subPrefix = depth == -1 ? '' : fst === 2 ? '   ' : '│  ';
      printDependency(dep.resolved, evaluated, lines, circularLinks, [...evalThis], subFst, prefix + subPrefix);
    }
  });
  return true;
};

const fillWhitespace = (original: string, current: string, char: string, targetLength: number): string => {
  if (current.length < original.length + 1) {
    current += ' ';
  }

  let position = original.length + 1;
  let repeats = targetLength - (original.length + 1);

  // Replace existing whitespace characters
  while (position < current.length && repeats > 0) {
    if (current[position] != char && current[position] == ' ') {
      current = current.slice(0, position) + char + current.slice(position + 1);
    }

    position++;
    repeats--;
  }

  if (repeats > 0) {
    current += char.repeat(repeats);
  }

  return current;
};

const printTree = (item: ItemContentDependancies, evaluated: Set<ItemContentDependancies>): boolean => {
  const lines: string[] = [];
  const circularLinks: CircularLink[] = [];

  const result = printDependency(item, evaluated, lines, circularLinks, [], 0, '');

  if (!result) return false;

  const modifiedLines = [...lines];

  // Render circular references.
  // These are drawn as pipes on the right hand side, from a start line to an end line.

  const maxWidth = Math.max(...lines.map(x => x.length));

  for (let i = 0; i < circularLinks.length; i++) {
    const link = circularLinks[i];
    let linkDist = maxWidth + 2;

    // Find overlapping circular links. Push the link out further if a previously drawn line is there.
    for (let j = 0; j < i; j++) {
      const link2 = circularLinks[j];
      if (link[0] <= link2[1] && link[1] >= link2[0]) {
        linkDist += 2;
      }
    }

    // Write the circular dependency lines into the tree.

    for (let ln = link[0]; ln <= link[1]; ln++) {
      const end = ln == link[0] || ln == link[1];
      const original = lines[ln];
      let current = modifiedLines[ln];

      current = fillWhitespace(original, current, end ? circularLine : ' ', linkDist);
      current += circularPipes[firstSecondThird(ln - link[0], link[1] - link[0] + 1)];

      modifiedLines[ln] = current;
    }
  }

  modifiedLines.forEach(line => console.log(line));
  console.log('');
  return true;
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

  for (let i = tree.levels.length - 1; i >= 0; i--) {
    const level = tree.levels[i];
    console.log(`=== LEVEL ${i + 1} (${level.items.length}) ===`);

    level.items.forEach(item => {
      printTree(item, evaluated);
    });
  }

  console.log(`=== CIRCULAR (${tree.circularLinks.length}) ===`);
  let topLevelPrints = 0;
  tree.circularLinks.forEach(item => {
    if (printTree(item, evaluated)) {
      topLevelPrints++;
    }
  });

  console.log(`Finished. Circular Dependencies printed: ${topLevelPrints}`);
};
