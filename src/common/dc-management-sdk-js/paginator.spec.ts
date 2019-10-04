import paginator, { DEFAULT_SIZE } from './paginator';
import MockPage from './mock-page';
import { Hub } from 'dc-management-sdk-js';

describe('paginator', function() {
  afterEach(() => {
    jest.resetAllMocks();
  });
  const mockPagableFn = jest.fn();
  describe('1 page', function() {
    const mockPage = new MockPage(Hub, [new Hub({ id: 'id' })], {
      page: {
        number: 0,
        totalPages: 1,
        size: 1,
        totalElements: 1
      }
    });

    it('should return invoke pageableFn once if there is only 1 page', async function() {
      mockPagableFn.mockResolvedValueOnce(mockPage);
      const result = await paginator(mockPagableFn);

      expect(result.length).toEqual(1);
      expect(mockPagableFn).toHaveBeenCalledWith({ size: DEFAULT_SIZE });
    });

    it('should return invoke pageableFn once if there is only 1 page passing the user options to each call', async function() {
      mockPagableFn.mockResolvedValueOnce(mockPage);
      const options = {
        sort: 'createdDate,asc'
      };
      const result = await paginator(mockPagableFn, options);

      expect(result.length).toEqual(1);
      expect(mockPagableFn).toHaveBeenCalledWith({ ...options, size: DEFAULT_SIZE });
    });
  });

  describe('multiple pages', function() {
    const mockPagableFn = jest.fn();
    const mockPage1 = new MockPage(Hub, [new Hub({ id: 'id' })], {
      page: {
        number: 0,
        totalPages: 2,
        size: 1,
        totalElements: 2
      }
    });
    const mockPage2 = new MockPage(Hub, [new Hub({ id: 'id' })], {
      page: {
        number: 1,
        totalPages: 2,
        size: 1,
        totalElements: 2
      }
    });

    it('should return invoke pageableFn twice if there are 2 pages', async function() {
      mockPagableFn.mockResolvedValueOnce(mockPage1);
      mockPagableFn.mockResolvedValueOnce(mockPage2);

      const result = await paginator(mockPagableFn);

      expect(result.length).toEqual(2);
      expect(mockPagableFn).toHaveBeenCalledWith({ size: DEFAULT_SIZE });
      expect(mockPagableFn).toHaveBeenCalledWith({ size: DEFAULT_SIZE });
    });

    it('should return invoke pageableFn twice if there are 2 pages passing the user options to each call', async function() {
      mockPagableFn.mockResolvedValueOnce(mockPage1);
      mockPagableFn.mockResolvedValueOnce(mockPage2);

      const options = {
        sort: 'createdDate,asc'
      };
      const result = await paginator(mockPagableFn, options);

      expect(result.length).toEqual(2);
      expect(mockPagableFn).toHaveBeenCalledWith({ ...options, size: DEFAULT_SIZE });
      expect(mockPagableFn).toHaveBeenCalledWith({ ...options, size: DEFAULT_SIZE });
    });
  });
});
