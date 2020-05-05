export default interface ArchiveOptions {
  id?: string;
  schemaId?: string | string[];
  logFile: string;
  revertLog?: string;
  force?: boolean;
  silent?: boolean;
  ignoreError?: boolean;
}
