import { ArchiveLog } from './archive/archive-log';

export class FileLog extends ArchiveLog {
  closed: boolean;

  constructor(private filename?: string) {
    super((filename || '').replace('<DATE>', Date.now().toString()));

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

  public async close(): Promise<void> {
    if (this.filename != null) {
      await this.writeToFile(this.filename);
    }

    this.closed = true;
  }
}
