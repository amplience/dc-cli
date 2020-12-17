import { readFile, writeFile, exists, mkdir } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';

export class WorkflowStatesMapping {
  workflowStates: Map<string, string>;

  constructor() {
    this.workflowStates = new Map<string, string>();
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
    const obj: SerializedStatesMapping = {
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

      this.workflowStates = new Map(obj.workflowStates);
      return true;
    } catch (e) {
      return false;
    }
  }
}

interface SerializedStatesMapping {
  workflowStates: [string, string][];
}
