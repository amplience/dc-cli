export interface YargObject<T> {
  [key: string]: T;
}

// yargs returns true when omitting dot notation on YargObjects e.g. --icons
// allowing the transformer to accept a boolean returns [] so we can empty properties that are arrays
export const transformYargObjectToArray = <T>(yargObject: YargObject<T> | boolean): T[] => {
  return Object.entries(yargObject).map(entry => entry[1]);
};
