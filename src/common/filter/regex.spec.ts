import { hasRegexSpecialCharacter, isRegexString, removeEscapes } from './regex';

describe('regex', () => {
  describe('isRegexString tests', () => {
    it('should return true only if string starts and ends with /', () => {
      expect(isRegexString('')).toBeFalsy();
      expect(isRegexString('/')).toBeFalsy();
      expect(isRegexString('nope')).toBeFalsy();
      expect(isRegexString('/not regex')).toBeFalsy();
      expect(isRegexString('/not/regex')).toBeFalsy();
      expect(isRegexString('still not/regex/')).toBeFalsy();

      expect(isRegexString('/regex/')).toBeTruthy();
      expect(isRegexString('//')).toBeTruthy();
    });
  });

  describe('hasRegexSpecialCharacter tests', () => {
    it('should return true for all regex special characters', () => {
      expect(hasRegexSpecialCharacter('')).toBeFalsy();
      expect(hasRegexSpecialCharacter('definitely not')).toBeFalsy();

      expect(hasRegexSpecialCharacter('character - test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character / test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character ^ test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character $ test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character * test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character + test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character ? test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character . test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character ( test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character ) test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character | test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character [ test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character ] test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character { test')).toBeTruthy();
      expect(hasRegexSpecialCharacter('character } test')).toBeTruthy();

      expect(hasRegexSpecialCharacter('all -/^$*+?.()|[]{}')).toBeTruthy();
    });

    it('should return false for escaped regex special characters', () => {
      expect(hasRegexSpecialCharacter('still \\* fine')).toBeFalsy();
      expect(hasRegexSpecialCharacter('still \\] fine')).toBeFalsy();
      expect(hasRegexSpecialCharacter('still \\ fine')).toBeFalsy();

      expect(hasRegexSpecialCharacter('| not \\* fine')).toBeTruthy();
    });
  });

  describe('removeEscapes tests', () => {
    it('should remove escape backslashes', () => {
      expect(removeEscapes('\\|')).toEqual('|');
      expect(removeEscapes('text\\|with\\|escaped\\|pipe')).toEqual('text|with|escaped|pipe');
      expect(removeEscapes('\\\\t')).toEqual('\\t');
      expect(removeEscapes('\\\\')).toEqual('\\');
      expect(removeEscapes('\\\\\\')).toEqual('\\');
      expect(removeEscapes('\\')).toEqual('');
      expect(removeEscapes('\\\\\\\\')).toEqual('\\\\');
      expect(removeEscapes('\\\\\\\\\\')).toEqual('\\\\');
      expect(removeEscapes('\\a\\b\\c\\d')).toEqual('abcd');
    });
  });
});
