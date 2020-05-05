import { readFile, writeFile, exists, mkdir } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';

export interface ArchiveLogItem {
  comment: boolean;
  action?: string;
  data: string;
}

export class ArchiveLog {
  items: ArchiveLogItem[] = [];

  constructor(public title?: string) {}

  async loadFromFile(path: string): Promise<ArchiveLog> {
    const log = await promisify(readFile)(path, 'utf8');
    const logLines = log.split('\n');
    this.items = [];
    logLines.forEach(line => {
      if (line.startsWith('//')) {
        // The first comment is the title, all ones after it should be recorded as comment items.
        const message = line.substring(2).trimLeft();
        if (this.items.length == 0) {
          this.title = message;
        } else {
          this.addComment(message);
        }
        return;
      }
      const lineSplit = line.split(' ');
      if (lineSplit.length >= 2) {
        this.addAction(lineSplit[0], lineSplit.slice(1).join(' '));
      }
    });
    return this;
  }

  async writeToFile(path: string): Promise<boolean> {
    try {
      let log = `// ${this.title}\n`;
      this.items.forEach(item => {
        if (item.comment) {
          log += `// ${item.data}\n`;
        } else {
          log += `${item.action} ${item.data}\n`;
        }
      });

      const dir = dirname(path);
      if (!(await promisify(exists)(dir))) {
        await promisify(mkdir)(dir);
      }
      await promisify(writeFile)(path, log);
      console.log(`Log written to "${path}".`);
      return true;
    } catch {
      console.log('Could not write log.');
      return false;
    }
  }

  addComment(comment: string): void {
    const lines = comment.split('\n');
    lines.forEach(line => {
      this.items.push({ comment: true, data: line });
    });
  }

  addAction(action: string, data: string): void {
    this.items.push({ comment: false, action: action, data: data });
  }

  getData(action: string): string[] {
    return this.items.filter(item => !item.comment && item.action === action).map(item => item.data);
  }
}
