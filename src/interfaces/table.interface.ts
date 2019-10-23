export interface TableStream {
  write: (row: string[]) => void;
}
