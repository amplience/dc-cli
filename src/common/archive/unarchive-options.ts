export default interface UnarchiveOptions {
  id?: string;
  schemaId?: string | string[];
  repoId?: string | string[];
  folderId?: string | string[];
  revertLog?: string;

  facet?: string;

  logFile?: string;
  force?: boolean;
  silent?: boolean;
  ignoreError?: boolean;
}
