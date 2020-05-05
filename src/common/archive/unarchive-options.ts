export default interface UnarchiveOptions {
  id?: string;
  schemaId?: string | string[];
  logFile: string;
  revertLog?: string;
  silent?: boolean;
  ignoreError?: boolean;
}
