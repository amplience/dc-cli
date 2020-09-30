import { ArchiveLog } from './archive/archive-log';

export class FileLog extends ArchiveLog {
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

  public async close(): Promise<void> {
    if (this.filename != null) {
      await this.writeToFile(this.filename);
    }
  }
}
