export function isRegexString(regex: string): boolean {
  return regex.length > 1 && regex[0] === '/' && regex[regex.length - 1] === '/';
}

export function hasRegexSpecialCharacter(regex: string): boolean {
  const regexMatch = /([^\\]|^)(\\\\)*[-\/^$*+?.()|[\]{}]/g;
  return regexMatch.test(regex);
}

export function removeEscapes(regex: string): string {
  for (let i = 0; i < regex.length; i++) {
    if (regex[i] === '\\') {
      regex = regex.substr(0, i) + regex.substr(i + 1);
    }
  }

  return regex;
}
