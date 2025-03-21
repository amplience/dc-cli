import { HttpError, HttpMethod } from 'dc-management-sdk-js';
import { HttpError as ChHttpError } from 'dc-management-sdk-js';
import errorHandler from './error-handler';

jest.useFakeTimers().setSystemTime(new Date('2025-02-24T01:01:01.001Z'));

describe('error handler tests', function () {
  const spyConsoleError = jest.spyOn(console, 'error');
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should display sdk error (string)', async () => {
    errorHandler(
      'The list-content-type-schemas action is not available, ensure you have permission to perform this action.'
    );
    expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
  });

  it('should display sdk error ({message: string})', async () => {
    errorHandler({ message: 'Error message' });
    expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
  });

  it('should display sdk error (new Error())', async () => {
    errorHandler(new Error('Error instance'));
    expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
  });

  describe('HttpErrors', function () {
    it('should display sdk http error', async () => {
      errorHandler(new HttpError('Message'));
      expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should display sdk http 400 error', async () => {
      errorHandler(new HttpError('Message', undefined, { status: 400, data: {} }));
      expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should display sdk http 401 error', async () => {
      errorHandler(new HttpError('Message', undefined, { status: 401, data: {} }));
      expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should display sdk http 403 error', async () => {
      errorHandler(new HttpError('Message', undefined, { status: 403, data: {} }));
      expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should display sdk http 403 error (with request)', async () => {
      errorHandler(
        new HttpError('Message', { method: HttpMethod.PATCH, url: 'http://example.com' }, { status: 403, data: {} })
      );
      expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should display sdk http 429 error', async () => {
      errorHandler(new HttpError('Message', undefined, { status: 429, data: {} }));
      expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should display sdk http 500 error', async () => {
      errorHandler(new HttpError('Message', undefined, { status: 500, data: {} }));
      expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should display sdk http 501 error - unmapped status code', async () => {
      errorHandler(new HttpError('Message', undefined, { status: 501, data: {} }));
      expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should display sdk http network error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorHandler(new HttpError('Network error', undefined, { status: undefined as any, data: {} }));
      expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should display contenthub http network error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorHandler(new ChHttpError('Network error', undefined, { status: undefined as any, data: {} }));
      expect(spyConsoleError.mock.calls[0][0]).toMatchSnapshot();
    });
  });
});
