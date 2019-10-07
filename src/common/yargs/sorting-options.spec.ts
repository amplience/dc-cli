import { extractSortable } from './sorting-options';

describe('paging options', function() {
  describe('extractSortable tests', function() {
    it('should return a default empty object when supplied an empty object', function() {
      const result = extractSortable({});
      expect(result).toEqual({});
    });

    it('should return the sort value', function() {
      const result = extractSortable({ sort: 'createdBy,asc' });
      expect(result).toEqual({ sort: 'createdBy,asc' });
    });
  });
});
