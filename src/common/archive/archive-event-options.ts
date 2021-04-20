export default interface ArchiveOptions {
  id?: string | string[];

  name?: string | string[];

  logFile?: string;
  force?: boolean;
  silent?: boolean;
  ignoreError?: boolean;
}
