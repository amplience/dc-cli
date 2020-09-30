import { equalsOrRegex } from './filter';

describe('filter', () => {
  describe('filter tests', () => {
    it('should search with a regex if the string starts and ends with /', () => {
      expect(equalsOrRegex('test filter match', '/filter/')).toBeTruthy();
      expect(equalsOrRegex('test filter match', '/f.*r/')).toBeTruthy();

      expect(equalsOrRegex('not match', '/filter/')).toBeFalsy();
      expect(equalsOrRegex('test filter match', '/f.*z/')).toBeFalsy();
    });

    it('should check equality when not surrounded by /', () => {
      expect(equalsOrRegex('filter', 'filter')).toBeTruthy();
      expect(equalsOrRegex('/filter', '/filter')).toBeTruthy();
      expect(equalsOrRegex('filter/', 'filter/')).toBeTruthy();

      expect(equalsOrRegex('test filter match', 'filter')).toBeFalsy();
      expect(equalsOrRegex('filter', '/filter')).toBeFalsy();
      expect(equalsOrRegex('filter', 'filter/')).toBeFalsy();
    });

    it('should check equality when string is too short to contain a regex', () => {
      expect(equalsOrRegex('', '')).toBeTruthy();
      expect(equalsOrRegex('', 'filter')).toBeFalsy();
      expect(equalsOrRegex('text', '')).toBeFalsy();

      expect(equalsOrRegex('/', '/')).toBeTruthy();
      expect(equalsOrRegex('hell/o', '/')).toBeFalsy();
      expect(equalsOrRegex('', '/')).toBeFalsy();
    });

    it('should throw when a regex cannot be parsed', () => {
      let throws = false;
      try {
        equalsOrRegex('', '/filter\\/');
      } catch {
        throws = true;
      }
      expect(throws).toEqual(true);
    });
  });
});
