import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { revert } from './import-revert';
import { FileLog } from '../../common/file-log';
import { dirname, basename, join, relative, resolve, extname } from 'path';

import { lstat, readdir, readFile } from 'fs';
import { promisify } from 'util';
import { ImportItemBuilderOptions } from '../../interfaces/import-item-builder-options.interface';
import paginator from '../../common/dc-management-sdk-js/paginator';
import {
  ContentItem,
  Folder,
  DynamicContent,
  Hub,
  ContentRepository,
  ContentType,
  ContentTypeSchema,
  Status
} from 'dc-management-sdk-js';
import { ContentMapping } from '../../common/content-item/content-mapping';
import {
  ContentDependancyTree,
  RepositoryContentItem,
  ItemContentDependancies,
  ContentDependancyInfo
} from '../../common/content-item/content-dependancy-tree';
import { Body } from '../../common/content-item/body';

import { AmplienceSchemaValidator, defaultSchemaLookup } from '../../common/content-item/amplience-schema-validator';
import { createLog, getDefaultLogPath } from '../../common/log-helpers';
import { asyncQuestion } from '../../common/question-helpers';
import { PublishQueue } from '../../common/import/publish-queue';
import { MediaRewriter } from '../../common/media/media-rewriter';

export function getDefaultMappingPath(name: string, platform: string = process.platform): string {
  return join(
    process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname,
    '.amplience',
    `imports/`,
    `${name}.json`
  );
}

export const command = 'import <dir>';

export const desc = 'Import content items';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('item', 'import', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe:
        'Directory containing content items to import. If this points to an export manifest, we will try and import the content with the same absolute path and repositories as the export.',
      type: 'string',
      requiresArg: true
    })

    .option('baseRepo', {
      type: 'string',
      describe:
        'Import matching the given repository to the import base directory, by ID. Folder structure will be followed and replicated from there.'
    })

    .option('baseFolder', {
      type: 'string',
      describe:
        'Import matching the given folder to the import base directory, by ID. Folder structure will be followed and replicated from there.'
    })

    .option('mapFile', {
      type: 'string',
      describe:
        'Mapping file to use when updating content that already exists. Updated with any new mappings that are generated. If not present, will be created.'
    })

    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe:
        'Overwrite content, create and assign content types, and ignore content with missing types/references without asking.'
    })

    .alias('v', 'validate')
    .option('v', {
      type: 'boolean',
      boolean: true,
      describe: 'Only recreate folder structure - content is validated but not imported.'
    })

    .option('skipIncomplete', {
      type: 'boolean',
      boolean: true,
      describe: 'Skip any content items that has one or more missing dependancy.'
    })

    .option('publish', {
      type: 'boolean',
      boolean: true,
      describe: 'Publish any content items that have an existing publish status in their JSON.'
    })

    .option('republish', {
      type: 'boolean',
      boolean: true,
      describe: 'Republish content items regardless of whether the import changed them or not. (--publish not required)'
    })

    .option('excludeKeys', {
      type: 'boolean',
      boolean: true,
      describe: 'Exclude delivery keys when importing content items.'
    })

    .option('media', {
      type: 'boolean',
      boolean: true,
      describe:
        "Detect and rewrite media links to match assets in the target account's DAM. Your client must have DAM permissions configured."
    })

    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.',
      coerce: createLog
    });
};

interface ImportContext {
  client: DynamicContent;
  hub: Hub;
  repo: ContentRepository;
  baseDir: string;
  pathToFolderMap: Map<string, Promise<Folder | null>>;
  folderToSubfolderMap: Map<string, Promise<Folder[]>>;
  mapping: ContentMapping;
  rootFolders: Folder[];
  log: FileLog;
}

const getSubfolders = (context: ImportContext, folder: Folder): Promise<Folder[]> => {
  if (context.folderToSubfolderMap.has(folder.id as string)) {
    return context.folderToSubfolderMap.get(folder.id as string) as Promise<Folder[]>;
  }

  const subfolders = paginator(folder.related.folders.list);

  context.folderToSubfolderMap.set(folder.id as string, subfolders);
  return subfolders;
};

// eslint-disable-next-line prefer-const
let getOrCreateFolderCached: (context: ImportContext, path: string) => Promise<Folder>;
const getOrCreateFolder = async (context: ImportContext, rel: string): Promise<Folder> => {
  try {
    // Get the parent folder.
    const parentPath = dirname(rel);

    const parent = await getOrCreateFolderCached(context, resolve(context.baseDir, parentPath));

    const folderInfo = {
      name: basename(rel)
    };

    const container = parent == null ? context.rootFolders : await getSubfolders(context, parent);

    let result = container.find(target => target.name === folderInfo.name);

    const containerName = parent == null ? context.repo.label : parent.name;

    if (result == null) {
      if (parent == null) {
        result = await context.repo.related.folders.create(new Folder(folderInfo));
      } else {
        result = await parent.related.folders.create(new Folder(folderInfo));
      }

      context.log.appendLine(`Created folder in ${containerName}: '${rel}'.`);
    } else {
      context.log.appendLine(`Found existing subfolder in ${containerName}: '${rel}'.`);
    }

    return result;
  } catch (e) {
    context.log.appendLine(`Couldn't get or create folder ${rel}! ${e.toString()}`);
    throw e;
  }
};

getOrCreateFolderCached = async (context: ImportContext, path: string): Promise<Folder> => {
  let rel = relative(context.baseDir, path);
  if (rel === '') {
    rel = '.';
  }

  if (context.pathToFolderMap.has(rel)) {
    return await (context.pathToFolderMap.get(rel) as Promise<Folder>);
  }

  const resultPromise = getOrCreateFolder(context, rel);
  context.pathToFolderMap.set(rel, resultPromise);

  const result = await resultPromise;
  return result;
};

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

interface ContentImportResult {
  newItem: ContentItem;
  oldVersion: number;
}

const createOrUpdateContent = async (
  client: DynamicContent,
  repo: ContentRepository,
  existing: string | ContentItem | null,
  item: ContentItem
): Promise<ContentImportResult> => {
  let oldItem: ContentItem | null = null;
  if (typeof existing === 'string') {
    oldItem = await client.contentItems.get(existing);
  } else {
    oldItem = existing;
  }

  let result: ContentImportResult;

  if (oldItem == null) {
    result = { newItem: await repo.related.contentItems.create(item), oldVersion: 0 };
  } else {
    const oldVersion = oldItem.version || 0;
    item.version = oldItem.version;
    if (oldItem.status !== Status.ACTIVE) {
      // If an item is archived, it must be unarchived before updating it.
      oldItem = await oldItem.related.unarchive();
    }
    result = { newItem: await oldItem.related.update(item), oldVersion };
  }

  if (item.locale != null && result.newItem.locale != item.locale) {
    await result.newItem.related.setLocale(item.locale);
  }

  return result;
};

const itemShouldPublish = (item: ContentItem): boolean => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (item as any).publish; // Added when creating the filtered content.
};

const trySaveMapping = async (mapFile: string | undefined, mapping: ContentMapping, log: FileLog): Promise<void> => {
  if (mapFile != null) {
    try {
      await mapping.save(mapFile);
    } catch (e) {
      log.appendLine(`Failed to save the mapping. ${e.toString()}`);
    }
  }
};

const prepareContentForImport = async (
  client: DynamicContent,
  hub: Hub,
  repos: { basePath: string; repo: ContentRepository }[],
  folder: Folder | null,
  mapping: ContentMapping,
  log: FileLog,
  argv: Arguments<ImportItemBuilderOptions & ConfigurationParameters>
): Promise<ContentDependancyTree | null> => {
  // traverse folder structure and find content items
  // replicate relative path string in target repo/folder (create if does not exist)
  // if there is an existing mapping (old id to new id), update the existing content (check all before beginning and ask user)
  // otherwise create new

  const { force, skipIncomplete } = argv;

  const contexts = new Map<ContentRepository, ImportContext>();
  repos.forEach(repo => {
    const pathToFolderMap: Map<string, Promise<Folder | null>> = new Map();

    if (folder != null) {
      pathToFolderMap.set('.', Promise.resolve(folder));
    } else {
      pathToFolderMap.set('.', Promise.resolve(null));
    }

    contexts.set(repo.repo, {
      client,
      hub,
      repo: repo.repo,
      pathToFolderMap,
      baseDir: resolve(repo.basePath),
      folderToSubfolderMap: new Map(),
      mapping,
      rootFolders: [],
      log
    });
  });

  // Step 1: Prepare content for import. We traverse the input directory recursively and try to set up the directory structure on the repo.
  //         This will result in list of content to put in target folders.

  let contentItems: RepositoryContentItem[] = [];
  const schemaNames = new Set<string>();

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i].repo;
    const context = contexts.get(repo) as ImportContext;

    try {
      const folders = await paginator(repo.related.folders.list);

      for (let j = 0; j < folders.length; j++) {
        const folder = folders[j];

        let parent: Folder | null = null;

        try {
          parent = await folder.related.folders.parent();
        } catch {
          // When there is no parent, this will throw.
        }
        if (parent == null) {
          context.rootFolders.push(folder);
        }
      }
    } catch (e) {
      log.error(`Could not get base folders for repository ${repo.label}: `, e);
      return null;
    }

    log.appendLine(`Scanning structure and content in '${repos[i].basePath}' for repository '${repo.label}'...`);

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
        log.appendLine(`Couldn't read content item at '${path}': ${e.toString()}`);
        return;
      }

      // Get the folder id via the mapping.
      const folder = await getOrCreateFolderCached(context, dirname(path));

      // Only filter relevant information - for example status and previous content repo are not useful.
      const filteredContent = {
        id: contentJSON.id,
        label: contentJSON.label,
        locale: contentJSON.locale,
        body: contentJSON.body,
        deliveryId: contentJSON.deliveryId == contentJSON.Id || argv.excludeKeys ? undefined : contentJSON.deliveryId,
        folderId: folder == null ? null : folder.id,
        publish: contentJSON.lastPublishedVersion != null
      };

      if (argv.excludeKeys) {
        delete filteredContent.body._meta.deliveryKey;
      }

      schemaNames.add(contentJSON.body._meta.schema);

      contentItems.push({ repo: repo, content: new ContentItem(filteredContent) });
    });
  }

  log.appendLine('Done. Validating content...');

  const alreadyExists = contentItems.filter(item => mapping.getContentItem(item.content.id) != null);
  if (alreadyExists.length > 0) {
    const updateExisting =
      force ||
      (await asyncQuestion(
        `${alreadyExists.length} of the items being imported already exist in the mapping. Would you like to update these content items instead of skipping them? (y/n) `,
        log
      ));

    if (!updateExisting) {
      contentItems = contentItems.filter(item => mapping.getContentItem(item.content.id) == null);
    }
  }

  // Step 2: Content Type Mapping.
  // Find content types with matching schemas. If schemas are missing, we cannot continue.

  let types: ContentType[];
  let schemas: ContentTypeSchema[];
  try {
    types = await paginator(hub.related.contentTypes.list);
    schemas = await paginator(hub.related.contentTypeSchema.list);
  } catch (e) {
    log.error('Could not load content types:', e);
    return null;
  }

  const typesBySchema = new Map<string, ContentType>(types.map(type => [type.contentTypeUri as string, type]));

  const missingTypes = Array.from(schemaNames).filter(name => {
    return !typesBySchema.has(name);
  });

  if (missingTypes.length > 0) {
    // Alert the user of missing content types.
    // Can we create content types in the missing cases? (schema exists, not recommended)

    const existing = schemas.filter(schema => missingTypes.indexOf(schema.schemaId as string) !== -1);

    log.appendLine('Required content types are missing from the target hub.');
    if (existing.length > 0) {
      log.appendLine('The following required content types schemas exist, but do not exist as content types:');
      existing.forEach(schema => {
        log.appendLine(`  ${schema.schemaId}`);
      });
      const create =
        force ||
        (await asyncQuestion(
          'Content types can be automatically created for these schemas, but it is not recommended as they will have a default name and lack any configuration. Are you sure you wish to continue? (y/n) ',
          log
        ));
      if (!create) {
        return null;
      }

      log.warn(`Creating ${existing.length} missing content types.`);

      // Create the content types

      for (let i = 0; i < existing.length; i++) {
        const missing = existing[i];
        let type = new ContentType({
          contentTypeUri: missing.schemaId,
          settings: { label: basename(missing.schemaId as string) } // basename on a URL is valid.
        });
        type = await hub.related.contentTypes.register(type);
        types.push(type);
        typesBySchema.set(missing.schemaId as string, type);
      }
    }
  }

  // Are the content types used by the content items assigned to their repository? If not, we can assign it ourselves.

  const repom = new Map<ContentRepository, Set<ContentType>>();

  contentItems.forEach(item => {
    let repoSet = repom.get(item.repo);
    if (repoSet == null) {
      repoSet = new Set<ContentType>();
      repom.set(item.repo, repoSet);
    }

    const type = typesBySchema.get(item.content.body._meta.schema);
    if (type != null) {
      repoSet.add(type);
    }
  });

  const missingRepoAssignments: [ContentRepository, ContentType][] = [];
  Array.from(repom).forEach(([repo, expectedTypes]) => {
    // The repository must have each of the expected repo types.
    const expectedTypesArray = Array.from(expectedTypes);

    const missingTypes = expectedTypesArray.filter(
      expectedType => (repo.contentTypes || []).find(type => type.hubContentTypeId == expectedType.id) == null
    );
    missingTypes.forEach(missingType => missingRepoAssignments.push([repo, missingType]));
  });

  if (missingRepoAssignments.length > 0) {
    log.appendLine('Some content items are using types incompatible with the target repository. Missing assignments:');
    missingRepoAssignments.forEach(([repo, type]) => {
      let label = '<no label>';
      if (type.settings && type.settings.label) {
        label = type.settings.label;
      }
      log.appendLine(`  ${repo.label} - ${label} (${type.contentTypeUri})`);
    });

    const createAssignments =
      force ||
      (await asyncQuestion(
        'These assignments will be created automatically. Are you sure you still wish to continue? (y/n) ',
        log
      ));
    if (!createAssignments) {
      return null;
    }

    log.warn(`Creating ${missingRepoAssignments.length} missing repo assignments.`);

    try {
      await Promise.all(
        missingRepoAssignments.map(([repo, type]) => repo.related.contentTypes.assign(type.id as string))
      );
    } catch (e) {
      log.error('Failed creating repo assignments:', e);
      return null;
    }
  }

  // Step 2.5: Detect media links and rewrite their IDs, endpoints etc.
  if (argv.media) {
    log.appendLine(`Detecting and rewriting media links...`);
    const rewriter = new MediaRewriter(argv, contentItems);

    let missing: Set<string>;
    try {
      missing = await rewriter.rewrite();
    } catch (e) {
      log.error(
        `Failed to rewrite media links. Make sure your client is properly configured, or remove the --media flag.`,
        e
      );
      return null;
    }

    log.appendLine(`Finished rewriting media links.`);

    if (missing.size > 0) {
      log.warn(`${missing.size} media items could not be found in the target asset store. Ignoring.`);
    }
  }

  // Step 3: Track dependancies between content items and update them to match the new content ids.
  //         To do this, we must insert content that is depended on before inserting the replacement.
  //         Circular references cannot be resolved, so they should be handled by an insert with invalid id, then subsequent update.

  const tree = new ContentDependancyTree(contentItems, mapping);

  // Do all the content types that items use exist in the schema list?
  const missingSchema = tree.requiredSchema.filter(
    schemaId =>
      schemas.findIndex(schema => schema.schemaId === schemaId) === -1 &&
      types.findIndex(type => type.contentTypeUri === schemaId) === -1 // Can also exist with external schema.
  );

  if (missingSchema.length > 0) {
    log.appendLine('Required content type schema are missing from the target hub:');
    missingSchema.forEach(schema => log.appendLine(`  ${schema}`));
    log.appendLine(
      'All content referencing this content type schema, and any content depending on those items will be skipped.'
    );

    const affectedContentItems = tree.filterAny(item => {
      return missingSchema.indexOf(item.owner.content.body._meta.schema) !== -1;
    });

    // Ignore content items that use the required content type schema.
    const beforeRemove = tree.all.length;
    tree.removeContent(affectedContentItems);

    if (tree.all.length === 0) {
      log.error('No content remains after removing those with missing content type schemas. Aborting.');
      return null;
    }

    const ignore =
      force ||
      (await asyncQuestion(
        `${affectedContentItems.length} out of ${beforeRemove} content items will be skipped. Are you sure you still wish to continue? (y/n) `,
        log
      ));
    if (!ignore) {
      return null;
    }

    log.warn(`Skipping ${missingRepoAssignments.length} content items due to missing schemas.`);
  }

  // Do all the content items that we depend on exist either in the mapping or in the items we're importing?
  const missingIDs = new Set<string>();
  const invalidContentItems = tree.filterAny(item => {
    const missingDeps = item.dependancies.filter(
      dep => !tree.byId.has(dep.dependancy.id as string) && mapping.getContentItem(dep.dependancy.id) == null
    );
    missingDeps.forEach(dep => {
      if (dep.dependancy.id != null) {
        missingIDs.add(dep.dependancy.id);
      }
    });
    return missingDeps.length > 0;
  });

  if (invalidContentItems.length > 0) {
    if (skipIncomplete) {
      tree.removeContent(invalidContentItems);
    } else {
      const validator = new AmplienceSchemaValidator(defaultSchemaLookup(types, schemas));

      const mustSkip: ItemContentDependancies[] = [];
      await Promise.all(
        invalidContentItems.map(async item => {
          tree.removeContentDependanciesFromBody(
            item.owner.content.body,
            item.dependancies.map(dependancy => dependancy.dependancy)
          );

          try {
            const errors = await validator.validate(item.owner.content.body);
            if (errors.length > 0) {
              mustSkip.push(item);
            }
          } catch {
            // Just ignore invalid schema for now.
          }
        })
      );

      if (mustSkip.length > 0) {
        log.appendLine(
          'Required dependancies for the following content items are missing, and would cause validation errors if set null.'
        );
        log.appendLine('These items will be skipped:');
        mustSkip.forEach(item => log.appendLine(`  ${item.owner.content.label}`));

        tree.removeContent(mustSkip);
      }
    }

    log.appendLine('Referenced content items (targets of links/references) are missing from the import and mapping:');
    missingIDs.forEach(id => log.appendLine(`  ${id}`));
    const action = skipIncomplete ? 'skipped' : 'set as null';
    log.appendLine(
      `All references to these content items will be ${action}. Note: if you have already imported these items before, make sure you are using a mapping file from that import.`
    );

    if (tree.all.length === 0) {
      log.appendLine('No content remains after removing those with missing dependancies. Aborting.');
      return null;
    }

    invalidContentItems.forEach(item => log.appendLine(`  ${item.owner.content.label}`));

    const ignore =
      force ||
      (await asyncQuestion(
        `${invalidContentItems.length} out of ${contentItems.length} content items will be affected. Are you sure you still wish to continue? (y/n) `,
        log
      ));
    if (!ignore) {
      return null;
    }

    log.warn(`${invalidContentItems.length} content items ${action} due to missing references.`);
  }

  log.appendLine(
    `Found ${tree.levels.length} dependancy levels in ${tree.all.length} items, ${tree.circularLinks.length} referencing a circular dependancy.`
  );
  log.appendLine(`Importing ${tree.all.length} content items...`);

  return tree;
};

const rewriteDependancy = (dep: ContentDependancyInfo, mapping: ContentMapping, allowNull: boolean): void => {
  let id = mapping.getContentItem(dep.dependancy.id);

  if (id == null && !allowNull) {
    id = dep.dependancy.id;
  }

  if (dep.dependancy._meta.schema === '_hierarchy') {
    dep.owner.content.body._meta.hierarchy.parentId = id;
  } else if (dep.parent) {
    const parent = dep.parent as Body;
    if (id == null) {
      delete parent[dep.index];
    } else {
      parent[dep.index] = dep.dependancy;
      dep.dependancy.id = id;
    }
  }
};

const importTree = async (
  client: DynamicContent,
  tree: ContentDependancyTree,
  mapping: ContentMapping,
  log: FileLog,
  argv: Arguments<ImportItemBuilderOptions & ConfigurationParameters>
): Promise<boolean> => {
  const abort = (error: Error): void => {
    log.appendLine(`Importing content item failed, aborting. Error: ${error.toString()}`);
  };

  let publishable: { item: ContentItem; node: ItemContentDependancies }[] = [];

  for (let i = 0; i < tree.levels.length; i++) {
    const level = tree.levels[i];

    for (let j = 0; j < level.items.length; j++) {
      const item = level.items[j];
      const content = item.owner.content;

      // Replace any dependancies with the existing mapping.
      item.dependancies.forEach(dep => {
        rewriteDependancy(dep, mapping, false);
      });

      const originalId = content.id;
      content.id = mapping.getContentItem(content.id as string) || '';

      let newItem: ContentItem;
      let oldVersion: number;
      try {
        const result = await createOrUpdateContent(
          client,
          item.owner.repo,
          mapping.getContentItem(originalId as string) || null,
          content
        );
        newItem = result.newItem;
        oldVersion = result.oldVersion;
      } catch (e) {
        log.error(`Failed creating ${content.label}:`, e);
        abort(e);
        return false;
      }

      const updated = oldVersion > 0;
      log.addComment(`${updated ? 'Updated' : 'Created'} ${content.label}.`);
      log.addAction(
        updated ? 'UPDATE' : 'CREATE',
        (newItem.id || 'unknown') + (updated ? ` ${oldVersion} ${newItem.version}` : '')
      );

      if (itemShouldPublish(content) && (newItem.version != oldVersion || argv.republish)) {
        publishable.push({ item: newItem, node: item });
      }

      mapping.registerContentItem(originalId as string, newItem.id as string);
    }
  }

  // Filter publishables to remove items that will be published as part of another publish.
  // Cuts down on unnecessary requests.
  let publishChildren = 0;

  publishable = publishable.filter(entry => {
    let isTopLevel = true;

    tree.traverseDependants(
      entry.node,
      dependant => {
        if (dependant != entry.node && publishable.findIndex(entry => entry.node === dependant) !== -1) {
          isTopLevel = false;
        }
      },
      true
    );

    if (!isTopLevel) {
      publishChildren++;
    }

    return isTopLevel;
  });

  // Create circular dependancies with all the mappings we have, and update the mapping.
  // Do a second pass that updates the existing assets to point to the new ones.
  const newDependants: ContentItem[] = [];

  for (let pass = 0; pass < 2; pass++) {
    const mode = pass === 0 ? 'Creating' : 'Resolving';
    log.appendLine(`${mode} circular dependants.`);

    for (let i = 0; i < tree.circularLinks.length; i++) {
      const item = tree.circularLinks[i];
      const content = item.owner.content;

      item.dependancies.forEach(dep => {
        rewriteDependancy(dep, mapping, pass === 0);
      });

      const originalId = content.id;
      content.id = mapping.getContentItem(content.id) || '';

      let newItem: ContentItem;
      let oldVersion: number;
      try {
        const result = await createOrUpdateContent(
          client,
          item.owner.repo,
          newDependants[i] || mapping.getContentItem(originalId as string),
          content
        );
        newItem = result.newItem;
        oldVersion = result.oldVersion;
      } catch (e) {
        log.error(`Failed creating ${content.label}:`, e);
        abort(e);
        return false;
      }

      if (pass === 0) {
        // New mappings are created in the first pass, they are only propagated in the second.
        const updated = oldVersion > 0;
        log.addComment(`${updated ? 'Updated' : 'Created'} ${content.label}.`);
        log.addAction(
          updated ? 'UPDATE' : 'CREATE',
          (newItem.id || 'unknown') + (updated ? ` ${oldVersion} ${newItem.version}` : '')
        );

        newDependants[i] = newItem;
        mapping.registerContentItem(originalId as string, newItem.id as string);
        mapping.registerContentItem(newItem.id as string, newItem.id as string);
      } else {
        if (itemShouldPublish(content) && (newItem.version != oldVersion || argv.republish)) {
          publishable.push({ item: newItem, node: item });
        }
      }
    }
  }

  if (argv.publish) {
    const pubQueue = new PublishQueue(argv);
    log.appendLine(`Publishing ${publishable.length} items. (${publishChildren} children included)`);

    for (let i = 0; i < publishable.length; i++) {
      const item = publishable[i].item;

      try {
        await pubQueue.publish(item);
        log.appendLine(`Started publish for ${item.label}.`);
      } catch (e) {
        log.appendLine(`Failed to initiate publish for ${item.label}: ${e.toString()}`);
      }
    }

    log.appendLine(`Waiting for all publishes to complete...`);
    await pubQueue.waitForAll();

    log.appendLine(`Finished publishing, with ${pubQueue.failedJobs.length} failed publishes total.`);
    pubQueue.failedJobs.forEach(job => {
      log.appendLine(` - ${job.item.label}`);
    });
  }

  log.appendLine('Done!');
  return true;
};

export const handler = async (
  argv: Arguments<ImportItemBuilderOptions & ConfigurationParameters>
): Promise<boolean> => {
  if (await argv.revertLog) {
    return revert(argv);
  }

  const { dir, baseRepo, baseFolder, validate, logFile } = argv;
  const force = argv.force || false;
  let { mapFile } = argv;
  argv.publish = argv.publish || argv.republish;

  const client = dynamicContentClientFactory(argv);
  const log = logFile.open();

  const closeLog = async (): Promise<void> => {
    await log.close();
  };

  let hub: Hub;
  try {
    hub = await client.hubs.get(argv.hubId);
  } catch (e) {
    log.error(`Couldn't get hub:`, e);
    closeLog();
    return false;
  }

  let importTitle = 'unknownImport';
  if (baseFolder != null) {
    importTitle = `folder-${baseFolder}`;
  } else if (baseRepo != null) {
    importTitle = `repo-${baseRepo}`;
  } else {
    importTitle = `hub-${hub.id}`;
  }

  const mapping = new ContentMapping();
  if (mapFile == null) {
    mapFile = getDefaultMappingPath(importTitle);
  }

  if (mapping.load(mapFile)) {
    log.appendLine(`Existing mapping loaded from '${mapFile}', changes will be saved back to it.`);
  } else {
    log.appendLine(`Creating new mapping file at '${mapFile}'.`);
  }

  let tree: ContentDependancyTree | null;
  if (baseFolder != null) {
    let repo: ContentRepository;
    let folder: Folder;
    try {
      const bFolder = await client.folders.get(baseFolder);
      repo = await bFolder.related.contentRepository();
      folder = bFolder;
    } catch (e) {
      log.error(`Couldn't get base folder:`, e);
      closeLog();
      return false;
    }
    tree = await prepareContentForImport(client, hub, [{ repo, basePath: dir }], folder, mapping, log, argv);
  } else if (baseRepo != null) {
    let repo: ContentRepository;
    try {
      repo = await client.contentRepositories.get(baseRepo);
    } catch (e) {
      log.error(`Couldn't get base repository:`, e);
      closeLog();
      return false;
    }
    tree = await prepareContentForImport(client, hub, [{ repo, basePath: dir }], null, mapping, log, argv);
  } else {
    // Match repositories by label.
    let repos: ContentRepository[];
    try {
      repos = await paginator(hub.related.contentRepositories.list);
    } catch (e) {
      log.error(`Couldn't get repositories:`, e);
      closeLog();
      return false;
    }

    const baseDirContents = await promisify(readdir)(dir);
    const importRepos: { basePath: string; repo: ContentRepository }[] = [];
    const missingRepos: string[] = [];
    for (let i = 0; i < baseDirContents.length; i++) {
      const name = baseDirContents[i];
      const path = join(dir, name);
      const status = await promisify(lstat)(path);
      if (status.isDirectory()) {
        // does this folder map to a repository name?
        const match = repos.find(repo => repo.label === name);
        if (match) {
          importRepos.push({ basePath: path, repo: match });
        } else {
          missingRepos.push(name);
        }
      }
    }

    if (missingRepos.length > 0) {
      log.appendLine(
        "The following repositories must exist on the destination hub to import content into them, but don't:"
      );
      missingRepos.forEach(name => {
        log.appendLine(`  ${name}`);
      });
      if (importRepos.length > 0) {
        const ignore =
          force ||
          (await asyncQuestion(
            'These repositories will be skipped during the import, as they need to be added to the hub manually. Do you want to continue? (y/n) ',
            log
          ));
        if (!ignore) {
          closeLog();
          return false;
        }

        log.warn(`${missingRepos.length} repositories skipped.`);
      }
    }

    if (importRepos.length == 0) {
      log.error('Could not find any matching repositories to import into, aborting.');
      closeLog();
      return false;
    }

    tree = await prepareContentForImport(client, hub, importRepos, null, mapping, log, argv);
  }

  let result = true;

  if (tree != null) {
    if (!validate) {
      result = await importTree(client, tree, mapping, log, argv);
    } else {
      log.appendLine('--validate was passed, so no content was imported.');
    }
  }

  trySaveMapping(mapFile, mapping, log);
  closeLog();
  return result;
};
