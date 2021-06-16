import { ArchiveLog } from './archive/archive-log';

export class FileLog extends ArchiveLog {
  private openedCount = 0;
  closed: boolean;

  constructor(private filename?: string) {
    super((filename || '').replace('<DATE>', Date.now().toString()));

    if (this.filename != null) {
      const timestamp = Date.now().toString();
      this.filename = this.filename.replace('<DATE>', timestamp);
    }
  }

  public appendLine(text?: string): void {
    console.log(text);

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
