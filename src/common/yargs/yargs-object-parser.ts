export interface YargObject<T> {
  [key: string]: T;
}

export const parseYargObjectToArray = <T, U>(yargObject: T): U[] => {
  return Object.entries(yargObject)
    .sort((a, b) => (parseInt(a[0], 10) > parseInt(b[0], 10) ? 1 : -1))
    .map(entry => entry[1]);
};
