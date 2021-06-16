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

export const command = 'tree <dir>';

export const desc = 'Print a content dependency tree from content in the given folder.';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('item', 'tree', platform);

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    type: 'string',
    describe: 'Path to the content items to build a tree from. Should be in the same format as an export.'
  });
};

interface TreeOptions {
  dir: string;
}

export const traverseRecursive = async (path: string, action: (path: string) => Promise<void>): Promise<void> => {
  const dir = await promisify(readdir)(path);

  dir.sort();

  for (let i = 0; i < dir.length; i++) {
    let contained = dir[i];
    contained = join(path, contained);
    const stat = await promisify(lstat)(contained);
    if (stat.isDirectory()) {
      await traverseRecursive(contained, action);
    } else {
      await action(contained);
    }
  }
};

export const prepareContentForTree = async (repo: {
  basePath: string;
  repo: ContentRepository;
}): Promise<ContentDependancyTree> => {
  const contentItems: RepositoryContentItem[] = [];
  const schemaNames = new Set<string>();

  await traverseRecursive(resolve(repo.basePath), async path => {
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

    schemaNames.add(contentJSON.body._meta.schema);

    contentItems.push({ repo: repo.repo, content: new ContentItem(contentJSON) });
  });

  return new ContentDependancyTree(contentItems, new ContentMapping());
};

type LineIndexFrom = number;
type LineIndexTo = number;
type CircularLink = [LineIndexFrom, LineIndexTo];
interface ParentReference {
  item: ItemContentDependancies;
  line: number;
}

export const firstSecondThird = (index: number, total: number): number => {
  return index == total - 1 ? 2 : index === 0 ? 0 : 1;
};

const fstPipes = ['├', '├', '└'];
const circularPipes = ['╗', '║', '╝'];
const circularLine = '═';

export class TreeBuilder {
  lines: string[] = [];
  circularLinks: CircularLink[] = [];

  constructor(public evaluated: Set<ItemContentDependancies>) {}

  addDependency(item: ItemContentDependancies, evalThis: ParentReference[], fst: number, prefix: string): boolean {
    const depth = evalThis.length - 1;
    const pipe = depth < 0 ? '' : fstPipes[fst] + '─ ';

    const circularMatch = evalThis.find(parent => parent.item == item);
    if (circularMatch) {
      this.lines.push(`${prefix}${pipe}*** (${item.owner.content.label})`);
      this.circularLinks.push([circularMatch.line, this.lines.length - 1]);
      return false;
    } else if (this.evaluated.has(item)) {
      if (depth > -1) {
        this.lines.push(`${prefix}${pipe}(${item.owner.content.label})`);
      }
      return false;
    } else {
      this.lines.push(`${prefix}${pipe}${item.owner.content.label}`);
    }

    evalThis.push({ item, line: this.lines.length - 1 });
    this.evaluated.add(item);

    const filteredItems = item.dependancies.filter(dep => dep.resolved);
    filteredItems.forEach((dep, index) => {
      const subFst = firstSecondThird(index, filteredItems.length);
      const subPrefix = depth == -1 ? '' : fst === 2 ? '   ' : '│  ';
      this.addDependency(dep.resolved as ItemContentDependancies, [...evalThis], subFst, prefix + subPrefix);
    });
    return true;
  }
}

export const fillWhitespace = (original: string, current: string, char: string, targetLength: number): string => {
  let position = original.length;
  let repeats = targetLength - original.length;

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

export const printTree = (item: ItemContentDependancies, evaluated: Set<ItemContentDependancies>): boolean => {
  const builder = new TreeBuilder(evaluated);

  const result = builder.addDependency(item, [], 0, '');

  if (!result) return false;

  const circularLinks = builder.circularLinks;
  const lines = builder.lines.map(line => line + ' ');
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

  const tree = await prepareContentForTree({ basePath: dir, repo: new ContentRepository() });

  // Print the items in the tree.
  // Keep a set of all items that have already been printed.
  // Starting at the highest level, print all dependencies on the tree.

  const evaluated = new Set<ItemContentDependancies>();

  for (let i = tree.levels.length - 1; i >= 0; i--) {
    const level = tree.levels[i];
    console.log(`=== LEVEL ${i + 1} (${level.items.length}) ===`);

    level.items.forEach(item => {
      printTree(item, evaluated);
    });
  }

  let topLevelPrints = 0;

  if (tree.circularLinks.length > 0) {
    console.log(`=== CIRCULAR (${tree.circularLinks.length}) ===`);

    tree.circularLinks.forEach(item => {
      if (printTree(item, evaluated)) {
        topLevelPrints++;
      }
    });
  }

  console.log(`Finished. Circular Dependencies printed: ${topLevelPrints}`);
};
