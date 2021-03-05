import { ImportItemBuilderOptions } from '../../interfaces/import-item-builder-options.interface';
import { ConfigurationParameters } from '../configure';
import { Arguments } from 'yargs';
import { FileLog } from '../../common/file-log';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentItem } from 'dc-management-sdk-js';
import { asyncQuestion } from '../../common/log-helpers';

export const revert = async (argv: Arguments<ImportItemBuilderOptions & ConfigurationParameters>): Promise<boolean> => {
  let log: FileLog;

  if (typeof argv.revertLog === 'string') {
    log = new FileLog();
    try {
      await log.loadFromFile(argv.revertLog as string);
    } catch (e) {
      console.log('Could not open the import log! Aborting.');
      return false;
    }
  } else {
    log = argv.revertLog as FileLog;
  }

  // We just need to access the destination repo to undo a import.
  const client = dynamicContentClientFactory(argv);

  const toArchive = log.getData('CREATE'); // Undo created content by archiving it.
  const toDowngrade = log.getData('UPDATE'); // Undo updated content by downgrading it.

  const items: { item: ContentItem; oldVersion: number; newVersion: number }[] = [];

  for (let i = 0; i < toArchive.length; i++) {
    const id = toArchive[i];

    try {
      const item = await client.contentItems.get(id);
      items.push({ item, oldVersion: 0, newVersion: 1 });
    } catch {
      console.log(`Could not find item with id ${id}, skipping.`);
    }
  }

  let unchanged = 0;

  for (let i = 0; i < toDowngrade.length; i++) {
    const split = toDowngrade[i].split(' ');
    if (split.length !== 3) {
      continue; // Must be in format (id, oldVersion, newVersion)
    }
    const id = split[0];
    const oldVersion = Number(split[1]);
    const newVersion = Number(split[2]);

    if (oldVersion === newVersion) {
      unchanged++;
      continue;
    }

    try {
      const item = await client.contentItems.get(id);
      items.push({ item, oldVersion, newVersion });
    } catch {
      console.log(`Could not find item with id ${id}, skipping.`);
    }
  }

  if (unchanged > 0) {
    console.log(
      `${unchanged} content items were imported, but were not updated so there is nothing to revert. Ignoring.`
    );
  }

  const changed = items.filter(entry => entry.item.version !== entry.newVersion);

  if (changed.length > 0) {
    console.log(`${changed.length} content items have been changed since they were imported:`);

    changed.forEach(entry => {
      const hasBeenArchived = entry.item.status !== 'ACTIVE' ? ', has been archived)' : '';
      const summary = `(modified ${(entry.item.version as number) -
        entry.newVersion} times since import${hasBeenArchived})`;
      console.log(`  ${entry.item.label} ${summary}`);
    });

    const answer = await asyncQuestion(
      'Do you want to continue with the revert, losing any changes made since the import? (y/n)\n'
    );

    if (!answer) {
      return false;
    }
  }

  if (items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const entry = items[i];
      const item = entry.item;

      if (entry.oldVersion === 0) {
        // Reverting should archive.
        if (item.status === 'ACTIVE') {
          console.log(`Archiving ${item.label}.`);
          try {
            await item.related.archive();
          } catch (e) {
            console.log(`Could not archive ${item.label}!\n${e.toString()}\nContinuing...`);
          }
        }
      } else {
        let oldItem: ContentItem;
        try {
          oldItem = await item.related.contentItemVersion(entry.oldVersion);
        } catch (e) {
          console.log(`Could not get old version for ${item.label}!\n${e.toString()}\nContinuing...`);
          continue;
        }

        console.log(`Reverting ${item.label} to version ${entry.oldVersion}.`);

        try {
          await item.related.update(oldItem);
        } catch (e) {
          console.log(`Could not revert ${item.label}!\n${e.toString()}\nContinuing...`);
        }
      }
    }
  } else {
    console.log('No actions found to revert.');
  }

  console.log('Done!');
  return true;
};
