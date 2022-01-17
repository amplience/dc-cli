import { dateMax, dateMin, dateOffset, sortByEndDate } from './date-helpers';

jest.mock('fs');

describe('date-helpers', () => {
  describe('dateOffset', () => {
    it('should return the current date plus the number of seconds', () => {
      const now = Date.now();
      const allowance = 500; //+-0.5s allowance for test variation.

      expect(Math.abs(dateOffset(0).getTime() - now)).toBeLessThan(allowance);
      expect(Math.abs(dateOffset(90).getTime() - (now + 90 * 1000))).toBeLessThan(allowance);
      expect(Math.abs(dateOffset(23473).getTime() - (now + 23473 * 1000))).toBeLessThan(allowance);
      expect(Math.abs(dateOffset(-123).getTime() - (now - 123 * 1000))).toBeLessThan(allowance);
    });
  });

  describe('dateMax', () => {
    it('should return the later of two dates', () => {
      const earlier = new Date('2022-01-07T15:31:47.337Z');
      const later = new Date('2022-01-07T15:32:47.337Z');

      expect(dateMax(earlier, later)).toEqual(later);
      expect(dateMax(later, earlier)).toEqual(later);

      expect(dateMax(later, later)).toEqual(later);
    });
  });

  describe('dateMin', () => {
    it('should return the earlier of two dates', () => {
      const earlier = new Date('2022-01-07T15:31:47.337Z');
      const later = new Date('2022-01-07T15:32:47.337Z');

      expect(dateMin(earlier, later)).toEqual(earlier);
      expect(dateMin(later, earlier)).toEqual(earlier);

      expect(dateMin(earlier, earlier)).toEqual(earlier);
    });
  });

  describe('sortByEndDate', () => {
    it('should return the dates ordered by end date in ascending order', () => {
      const start = new Date('2022-01-07T15:30:47.337Z').toISOString();
      const earlier = { start, end: new Date('2022-01-07T15:31:47.337Z').toISOString() };
      const later = { start, end: new Date('2022-01-07T15:32:47.337Z').toISOString() };
      const latest = { start, end: new Date('2022-01-07T15:33:47.337Z').toISOString() };

      expect(sortByEndDate([earlier])).toEqual([earlier]);
      expect(sortByEndDate([later, earlier])).toEqual([earlier, later]);
      expect(sortByEndDate([earlier, later])).toEqual([earlier, later]);

      expect(sortByEndDate([earlier, later, latest])).toEqual([earlier, later, latest]);
      expect(sortByEndDate([later, latest, earlier])).toEqual([earlier, later, latest]);
      expect(sortByEndDate([latest, later, earlier])).toEqual([earlier, later, latest]);
      expect(sortByEndDate([earlier, latest, later])).toEqual([earlier, later, latest]);
      expect(sortByEndDate([later, earlier, latest])).toEqual([earlier, later, latest]);
      expect(sortByEndDate([latest, earlier, later])).toEqual([earlier, later, latest]);
    });
    it('should return an empty array when given one', () => {
      expect(sortByEndDate([])).toEqual([]);
    });
  });
});
