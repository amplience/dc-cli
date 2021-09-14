import { ArchiveLog } from './archive/archive-log';

let version = require('../../package.json').version;

export function setVersion(newVersion: string): void {
  version = newVersion;
}

export function versionedTitle(title: string): string {
  return `dc-cli ${version} - ${title}`;
}

function buildTitle(filename?: string): string {
  if (filename) {
    return versionedTitle(filename.replace('<DATE>', Date.now().toString()));
  } else {
    return '';
  }
}

export class FileLog extends ArchiveLog {
  private openedCount = 0;
  closed: boolean;

  constructor(private filename?: string) {
    super(buildTitle(filename));

    if (this.filename != null) {
      const timestamp = Date.now().toString();
      this.filename = this.filename.replace('<DATE>', timestamp);
    }
  }

  public appendLine(text = 'undefined', silent = false): void {
    if (!silent) {
      process.stdout.write(text + '\n');
    }

    this.addComment(text as string);
  }

  public open(): FileLog {
    this.openedCount++;

    return this;
  }

  public async close(writeIfClosed = true): Promise<void> {
    if (--this.openedCount <= 0) {
      if (this.filename != null && writeIfClosed) {
        await this.writeToFile(this.filename);
      }

      this.closed = true;
    }
  }
}
