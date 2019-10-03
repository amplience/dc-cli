import { extractPageableSortable } from './paging-options';

describe('paging options', function() {
  describe('extractPageableSortable tests', function() {
    it('should return a default empty object when supplied an empty object', function() {
      const result = extractPageableSortable({});
      expect(result).toEqual({});
    });

    it('should return the page value', function() {
      const result = extractPageableSortable({ page: 1 });
      expect(result).toEqual({ page: 1 });
    });

    it('should return the sort value', function() {
      const result = extractPageableSortable({ sort: 'createdBy,asc' });
      expect(result).toEqual({ sort: 'createdBy,asc' });
    });

    it('should return the size value', function() {
      const result = extractPageableSortable({ size: 1 });
      expect(result).toEqual({ size: 1 });
    });
  });
});
