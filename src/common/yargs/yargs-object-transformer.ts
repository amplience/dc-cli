export interface YargObject<T> {
  [key: string]: T;
}

export const transformYargObjectToArray = <T>(yargObject: YargObject<T>): T[] => {
  return Object.entries(yargObject)
    .sort((a, b) => (parseInt(a[0], 10) > parseInt(b[0], 10) ? 1 : -1))
    .map(entry => entry[1]);
};
