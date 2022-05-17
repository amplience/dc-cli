import { HttpError } from 'dc-management-sdk-js';
import { FileLog } from '../file-log';
import { waitOnTimeout } from './retry-helpers';
import * as retryHelpers from './retry-helpers';

describe('retry-helpers', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const error504 = new HttpError('Error', undefined, { status: 504 } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const error502 = new HttpError('Error', undefined, { status: 502 } as any);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(retryHelpers, 'delay').mockResolvedValue();
  });

  describe('waitOnTimeout', () => {
    it('should not call check method when the initial request succeeds', async () => {
      const log = new FileLog();
      const request = jest.fn();
      request.mockResolvedValue(null);
      const finishedCheck = jest.fn();
      finishedCheck.mockResolvedValue(null);

      await waitOnTimeout(log, request, finishedCheck);

      expect(request).toHaveBeenCalled();
      expect(finishedCheck).not.toHaveBeenCalled();
      expect(log.accessGroup.length).toBe(0);
      expect(retryHelpers.delay).not.toHaveBeenCalled();
    });

    it('should call check method when the initial request fails with a 504, repeatedly until it returns true', async () => {
      const log = new FileLog();
      const request = jest.fn();
      request.mockRejectedValue(error504);
      const finishedCheck = jest.fn();
      finishedCheck.mockResolvedValueOnce(false);
      finishedCheck.mockResolvedValueOnce(false);
      finishedCheck.mockResolvedValueOnce(true);

      await waitOnTimeout(log, request, finishedCheck);

      expect(request).toHaveBeenCalled();
      expect(finishedCheck).toHaveBeenCalledTimes(3);
      expect(log.accessGroup.length).toBe(3);
      expect(retryHelpers.delay).toHaveBeenCalledTimes(3);
    });

    it('should call check method when the initial request fails with a 504, error when the check fails', async () => {
      const log = new FileLog();
      const request = jest.fn();
      request.mockRejectedValue(error504);
      const finishedCheck = jest.fn();
      finishedCheck.mockResolvedValue(false);

      await expect(waitOnTimeout(log, request, finishedCheck, true, 10)).rejects.toThrowError(error504);

      expect(request).toHaveBeenCalled();
      expect(finishedCheck).toHaveBeenCalledTimes(10);
      expect(log.accessGroup.length).toBe(11);
      expect(retryHelpers.delay).toHaveBeenCalledTimes(10);
    });

    it('should error and not call check method when the initial request fails with an error that has no response', async () => {
      const log = new FileLog();
      const request = jest.fn();
      request.mockRejectedValue(error504);
      const finishedCheck = jest.fn();
      finishedCheck.mockResolvedValue(false);

      // Still throws even if throwErrors is false.
      await expect(waitOnTimeout(log, request, finishedCheck, false, 10)).rejects.toThrowError(error504);

      expect(request).toHaveBeenCalled();
      expect(finishedCheck).toHaveBeenCalledTimes(10);
      expect(log.accessGroup.length).toBe(11);
      expect(retryHelpers.delay).toHaveBeenCalledTimes(10);
    });

    it('should error and not call check method when the initial request fails with a non-504 error', async () => {
      const log = new FileLog();
      const request = jest.fn();
      request.mockRejectedValue(error502);
      const finishedCheck = jest.fn();

      await expect(waitOnTimeout(log, request, finishedCheck)).rejects.toThrowError(error502);

      expect(request).toHaveBeenCalled();
      expect(finishedCheck).not.toHaveBeenCalled();
      expect(log.accessGroup.length).toBe(0);
      expect(retryHelpers.delay).not.toHaveBeenCalled();
    });

    it('should call check method when the initial request fails with a non-504 when throwErrors argument is false', async () => {
      const log = new FileLog();
      const request = jest.fn();
      request.mockRejectedValue(error502);
      const finishedCheck = jest.fn();
      finishedCheck.mockResolvedValueOnce(false);
      finishedCheck.mockResolvedValueOnce(false);
      finishedCheck.mockResolvedValueOnce(true);

      await waitOnTimeout(log, request, finishedCheck, false);

      expect(request).toHaveBeenCalled();
      expect(finishedCheck).toHaveBeenCalledTimes(3);
      expect(log.accessGroup.length).toBe(3);
      expect(retryHelpers.delay).toHaveBeenCalledTimes(3);
    });

    it('should ignore errors when calling the check method', async () => {
      const log = new FileLog();
      const request = jest.fn();
      request.mockRejectedValue(error504);
      const finishedCheck = jest.fn();
      finishedCheck.mockRejectedValueOnce(error502);
      finishedCheck.mockRejectedValueOnce(new Error('Generic Error'));
      finishedCheck.mockResolvedValueOnce(true);

      await waitOnTimeout(log, request, finishedCheck, false);

      expect(request).toHaveBeenCalled();
      expect(finishedCheck).toHaveBeenCalledTimes(3);
      expect(log.accessGroup.length).toBe(5);
      expect(retryHelpers.delay).toHaveBeenCalledTimes(3);
    });

    it('should rethrow the last error when calling the check method and it errors', async () => {
      const log = new FileLog();
      const request = jest.fn();
      request.mockRejectedValue(error504);
      const finishedCheck = jest.fn();
      finishedCheck.mockRejectedValueOnce(error502);

      await expect(waitOnTimeout(log, request, finishedCheck, false, 1)).rejects.toThrowError(error502);

      expect(request).toHaveBeenCalled();
      expect(finishedCheck).toHaveBeenCalledTimes(1);
      expect(log.accessGroup.length).toBe(1);
      expect(retryHelpers.delay).toHaveBeenCalledTimes(1);
    });

    it('should rethrow the initial error when calling the check method and it returns false every time', async () => {
      const log = new FileLog();
      const request = jest.fn();
      request.mockRejectedValue(error504);
      const finishedCheck = jest.fn();
      finishedCheck.mockResolvedValue(false);

      await expect(waitOnTimeout(log, request, finishedCheck, false, 1)).rejects.toThrowError(error504);

      expect(request).toHaveBeenCalled();
      expect(finishedCheck).toHaveBeenCalledTimes(1);
      expect(log.accessGroup.length).toBe(2);
      expect(retryHelpers.delay).toHaveBeenCalledTimes(1);
    });
  });
});
