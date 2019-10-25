export interface YargObject<T> {
  [key: string]: T;
}

// yargs returns true when omitting dot notation on YargObjects e.g. --icons
// allowing the transformer to accept a boolean returns [] so we can empty properties that are arrays
export const transformYargObjectToArray = <T>(yargObject: YargObject<T> | boolean): T[] => {
  const index = Object.keys(yargObject);
  if (index.length > 0 && index.indexOf('0') < 0) {
    throw new Error('Targeted array indexes are unsupported, please provide a full array index starting at 0');
  }

  return Object.entries(yargObject).map(entry => entry[1]);
};
