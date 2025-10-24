import { Id } from '../../interfaces/sdk-model-base';

export function equalsOrRegex(value: string, compare: string): boolean {
  if (compare.length > 1 && compare[0] === '/' && compare[compare.length - 1] === '/') {
    // Regex format, try parse as a regex and return if the value is a match.
    try {
      const regExp = new RegExp(compare.substr(1, compare.length - 2));
      return regExp.test(value);
    } catch (e) {
      console.error('Could not parse regex!');
      throw e;
    }
  }
  return value === compare;
}

export const filterById = <T extends Id>(
  listToFilter: T[],
  uriList: string[],
  deleted: boolean = false,
  typeName: string = ''
): T[] => {
  if (uriList.length === 0) {
    return listToFilter;
  }

  const unmatchedUriList: string[] = uriList.filter(id => !listToFilter.some(type => type.id === id));

  if (unmatchedUriList.length > 0) {
    throw new Error(
      `The following ${typeName} URI(s) could not be found: [${unmatchedUriList
        .map(u => `'${u}'`)
        .join(', ')}].\nNothing was ${!deleted ? 'exported' : 'deleted'}, exiting.`
    );
  }

  return listToFilter.filter(type => uriList.some(id => type.id === id));
};
