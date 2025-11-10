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
