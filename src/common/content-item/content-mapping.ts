import { readFile, writeFile, exists, mkdir } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';

export class ContentMapping {
  contentItems: Map<string, string>;
  contentTypes: Map<string, string>;

  constructor() {
    this.contentItems = new Map<string, string>();
    this.contentTypes = new Map<string, string>();
  }

  getContentItem(id: string | undefined): string | undefined {
    if (id === undefined) {
      return undefined;
    }

    return this.contentItems.get(id);
  }

  registerContentItem(fromId: string, toId: string): void {
    this.contentItems.set(fromId, toId);
  }

  getContentType(id: string | undefined): string | undefined {
    if (id === undefined) {
      return undefined;
    }

    return this.contentTypes.get(id);
  }

  registerContentType(fromId: string, toId: string): void {
    this.contentTypes.set(fromId, toId);
  }

  async save(filename: string): Promise<void> {
    const obj: SerializedContentMapping = {
      contentItems: Array.from(this.contentItems)
    };

    const text = JSON.stringify(obj);

    const dir = dirname(filename);
    if (!(await promisify(exists)(dir))) {
      await promisify(mkdir)(dir);
    }
    await promisify(writeFile)(filename, text, { encoding: 'utf8' });
  }

  async load(filename: string): Promise<boolean> {
    try {
      const text = await promisify(readFile)(filename, { encoding: 'utf8' });
      const obj = JSON.parse(text);

      this.contentItems = new Map(obj.contentItems);
      return true;
    } catch (e) {
      return false;
    }
  }
}

interface SerializedContentMapping {
  contentItems: [string, string][];
}
