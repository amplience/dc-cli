import { writeFile } from 'fs';
import { promisify } from 'util';

export class FileLog {
  private contents: string;

  constructor(private filename?: string) {
    if (this.filename != null) {
      const timestamp = Date.now().toString();
      this.filename = this.filename.replace('<DATE>', timestamp);
    }
  }

  public appendLine(text?: string): void {
    console.log(text);

    if (text !== null) {
      this.contents += text;
    }

    this.contents += '\n';
  }

  public async close(): Promise<void> {
    if (this.filename != null) {
      try {
        await promisify(writeFile)(this.filename, this.contents);
        console.log(`Log written to "${this.filename}".`);
      } catch {
        console.log(`Could not write log.`);
      }
    }
  }
}
