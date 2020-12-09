export default interface UnarchiveOptions {
  id?: string;
  schemaId?: string | string[];
  revertLog?: string;
  silent?: boolean;
  ignoreError?: boolean;
  repoId?: string | string[];
  folderId?: string | string[];
  name?: string | string[];
  contentType?: string | string[];
  force?: boolean;
  logFile?: string;
}
