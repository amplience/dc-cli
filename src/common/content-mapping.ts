import { readFile, writeFile, exists, mkdir } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';

export class ContentMapping {
  contentItems: Map<string, string>;
  workflowStates: Map<string, string>;

  constructor() {
    this.contentItems = new Map<string, string>();
    this.workflowStates = new Map<string, string>();
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

  getWorkflowState(id: string | undefined): string | undefined {
    if (id === undefined) {
      return undefined;
    }

    return this.workflowStates.get(id);
  }

  registerWorkflowState(fromId: string, toId: string): void {
    this.workflowStates.set(fromId, toId);
  }

  async save(filename: string): Promise<void> {
    const obj: SerializedContentMapping = {
      contentItems: Array.from(this.contentItems),
      workflowStates: Array.from(this.workflowStates)
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
      this.workflowStates = new Map(obj.workflowStates);
      return true;
    } catch (e) {
      return false;
    }
  }
}

interface SerializedContentMapping {
  contentItems: [string, string][];
  workflowStates: [string, string][];
}
