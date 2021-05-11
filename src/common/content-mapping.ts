import { readFile, writeFile, exists, mkdir } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';

export class ContentMapping {
  contentItems: Map<string, string>;
  workflowStates: Map<string, string>;
  events: Map<string, string>;
  editions: Map<string, string>;
  slots: Map<string, string>;
  snapshots: Map<string, string>;

  constructor() {
    this.contentItems = new Map<string, string>();
    this.workflowStates = new Map<string, string>();
    this.events = new Map<string, string>();
    this.editions = new Map<string, string>();
    this.slots = new Map<string, string>();
    this.snapshots = new Map<string, string>();
  }

  getContentItem(id: string | undefined): string | undefined {
    return id === undefined ? undefined : this.contentItems.get(id);
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

  getEvent(id: string | undefined): string | undefined {
    return id === undefined ? undefined : this.events.get(id);
  }

  registerEvent(fromId: string, toId: string): void {
    this.events.set(fromId, toId);
  }

  getEdition(id: string | undefined): string | undefined {
    return id === undefined ? undefined : this.editions.get(id);
  }

  registerEdition(fromId: string, toId: string): void {
    this.editions.set(fromId, toId);
  }

  getSlot(id: string | undefined): string | undefined {
    return id === undefined ? undefined : this.slots.get(id);
  }

  registerSlot(fromId: string, toId: string): void {
    this.slots.set(fromId, toId);
  }

  getSnapshot(id: string | undefined): string | undefined {
    return id === undefined ? undefined : this.snapshots.get(id);
  }

  registerSnapshot(fromId: string, toId: string): void {
    this.snapshots.set(fromId, toId);
  }

  async save(filename: string): Promise<void> {
    const obj: SerializedContentMapping = {
      contentItems: Array.from(this.contentItems),
      workflowStates: Array.from(this.workflowStates),
      events: Array.from(this.events),
      editions: Array.from(this.editions),
      slots: Array.from(this.slots),
      snapshots: Array.from(this.snapshots)
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
      this.events = obj.events ? new Map(obj.events) : new Map();
      this.editions = obj.editions ? new Map(obj.editions) : new Map();
      this.slots = obj.slots ? new Map(obj.slots) : new Map();
      this.snapshots = obj.snapshots ? new Map(obj.snapshots) : new Map();
      return true;
    } catch (e) {
      return false;
    }
  }
}

interface SerializedContentMapping {
  contentItems: [string, string][];
  workflowStates: [string, string][];
  events?: [string, string][];
  editions?: [string, string][];
  slots?: [string, string][];
  snapshots?: [string, string][];
}
