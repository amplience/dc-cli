export interface YargObject<T> {
  [key: string]: T;
}

const validateArrayIndex = <T>(yargObject: YargObject<T> | boolean): void => {
  const index = Object.keys(yargObject);
  if (index.length === 0) {
    return;
  }

  const isIndexSequential = index
    .sort((a: string, b: string) => (parseInt(a) > parseInt(b) ? 1 : -1))
    .every((suppliedIndex: string, actualIndex: number) => parseInt(suppliedIndex) == actualIndex);

  if (!isIndexSequential) {
    throw new Error('Targeted array indexes are unsupported, please provide a full array index starting at 0');
  }
};

// yargs returns true when omitting dot notation on YargObjects e.g. --icons
// allowing the transformer to accept a boolean returns [] so we can empty properties that are arrays
export const transformYargObjectToArray = <T>(yargObject: YargObject<T> | boolean): T[] => {
  validateArrayIndex(yargObject);

  return Object.entries(yargObject).map(entry => entry[1]);
};
