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
  items: ArchiveLogItem[] = [];

  constructor(public title?: string) {}

  async loadFromFile(path: string): Promise<ArchiveLog> {
    const log = await promisify(readFile)(path, 'utf8');
    const logLines = log.split('\n');
    this.items = [];
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
      this.items.forEach(item => {
        if (item.comment) {
          log += `// ${item.data}\n`;
        } else {
          log += `${item.action} ${item.data}\n`;
        }
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

  addError(level: LogErrorLevel, message: string, error?: Error): void {
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
