import { readFile, writeFile } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';
import { ensureDirectoryExists } from '../import/directory-utils';

export interface ArchiveLogItem {
  comment: boolean;
  action?: string;
  data: string;
}

export enum LogErrorLevel {
  NONE = 0,
  WARNING,
  ERROR
}

export class ArchiveLog {
  errorLevel: LogErrorLevel = LogErrorLevel.NONE;
  items: Map<string, ArchiveLogItem[]> = new Map([['_default', []]]);

  public accessGroup: ArchiveLogItem[];

  constructor(public title?: string) {
    this.accessGroup = this.items.get('_default') as ArchiveLogItem[];
  }

  async loadFromFile(path: string): Promise<ArchiveLog> {
    const log = await promisify(readFile)(path, 'utf8');
    const logLines = log.split('\n');

    this.switchGroup('_default');
    logLines.forEach((line, index) => {
      if (line.startsWith('//')) {
        // The first comment is the title, all ones after it should be recorded as comment items.
        const message = line.substring(2).trimLeft();
        if (this.title == null) {
          this.title = message;
        } else {
          this.addComment(message);
        }
        return;
      } else if (line.startsWith('> ')) {
        // Group start. End the active group and start building another.
        this.switchGroup(line.substring(2));
        return;
      }

      if (index === logLines.length - 1) {
        this.errorLevel = this.parseResultCode(line);
      } else {
        const lineSplit = line.split(' ');
        if (lineSplit.length >= 2) {
          this.addAction(lineSplit[0], lineSplit.slice(1).join(' '));
        }
      }
    });

    this.switchGroup('_default');
    return this;
  }

  private getResultCode(): string {
    switch (this.errorLevel) {
      case LogErrorLevel.NONE:
        return 'SUCCESS';
      case LogErrorLevel.ERROR:
        return 'FAILURE';
      default:
        return LogErrorLevel[this.errorLevel];
    }
  }

  private parseResultCode(code: string): LogErrorLevel {
    switch (code) {
      case 'SUCCESS':
        return LogErrorLevel.NONE;
      case 'FAILURE':
        return LogErrorLevel.ERROR;
      default:
        return LogErrorLevel[code as keyof typeof LogErrorLevel] || LogErrorLevel.NONE;
    }
  }

  async writeToFile(path: string): Promise<boolean> {
    try {
      let log = `// ${this.title}\n`;
      this.items.forEach((group, groupName) => {
        if (groupName !== '_default') {
          log += `> ${groupName}\n`;
        }

        group.forEach(item => {
          if (item.comment) {
            log += `// ${item.data}\n`;
          } else {
            log += `${item.action} ${item.data}\n`;
          }
        });
      });

      log += this.getResultCode();

      const dir = dirname(path);
      await ensureDirectoryExists(dir);

      await promisify(writeFile)(path, log);
      console.log(`Log written to "${path}".`);
      return true;
    } catch {
      console.log('Could not write log.');
      return false;
    }
  }

  private addError(level: LogErrorLevel, message: string, error?: Error): void {
    if (level > this.errorLevel) {
      this.errorLevel = level;
    }

    this.addAction(LogErrorLevel[level], '');
    this.addComment(LogErrorLevel[level] + ': ' + message);

    const errorLog = level == LogErrorLevel.ERROR ? console.error : console.warn;

    errorLog(LogErrorLevel[level] + ': ' + message);

    if (error) {
      this.addComment(error.toString());

      errorLog(error.toString());
    }
  }

  warn(message: string, error?: Error): void {
    this.addError(LogErrorLevel.WARNING, message, error);
  }

  error(message: string, error?: Error): void {
    this.addError(LogErrorLevel.ERROR, message, error);
  }

  switchGroup(group: string): void {
    let targetGroup = this.items.get(group);

    if (!targetGroup) {
      targetGroup = [];

      this.items.set(group, targetGroup);
    }

    this.accessGroup = targetGroup;
  }

  addComment(comment: string): void {
    const lines = comment.split('\n');
    lines.forEach(line => {
      this.accessGroup.push({ comment: true, data: line });
    });
  }

  addAction(action: string, data: string): void {
    this.accessGroup.push({ comment: false, action: action, data: data });
  }

  getData(action: string, group = '_default'): string[] {
    const items = this.items.get(group);

    if (!items) {
      throw new Error(`Group ${group} was missing from the log file.`);
    }

    return items.filter(item => !item.comment && item.action === action).map(item => item.data);
  }
}
