import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('@/lib/logger', () => ({ createLogger: () => log }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('API lifecycle logging', () => {
  it('correlates overlapping requests and stops waiting messages when each completes', async () => {
    const complete: Array<() => void> = [];
    const adapter = vi.fn(
      (config) =>
        new Promise<AxiosResponse>((resolve) => {
          complete.push(() =>
            resolve({
              data: {},
              status: 200,
              statusText: 'OK',
              headers: new AxiosHeaders(),
              config,
            }),
          );
        }),
    );
    const first = apiClient.get('/market-data/coverage', { params: { tickers: 'AAPL' }, adapter });
    const second = apiClient.get('/market-data/coverage', {
      params: { tickers: 'AAPL,NBIS' },
      adapter,
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(log.warn).toHaveBeenCalledTimes(2);
    const starts = log.info.mock.calls.map((call) => call[1] as { requestId: string });
    expect(starts[0]!.requestId).not.toBe(starts[1]!.requestId);
    complete[0]!();
    await first;
    await vi.advanceTimersByTimeAsync(5000);
    expect(log.warn).toHaveBeenCalledTimes(3);
    complete[1]!();
    await second;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(log.warn).toHaveBeenCalledTimes(3);
    expect(log.info).toHaveBeenCalledWith(
      'request completed: GET /market-data/coverage',
      expect.objectContaining({
        requestId: starts[1]!.requestId,
        params: { tickers: 'AAPL,NBIS' },
        status: 200,
      }),
    );
  });

  it('includes the original ticker selection and timeout in failures', async () => {
    const request = apiClient.get('/market-data/coverage', {
      params: { tickers: 'AAPL,NBIS' },
      timeout: 30_000,
      adapter: (config) => Promise.reject(new AxiosError('timeout', 'ECONNABORTED', config)),
    });
    await expect(request).rejects.toMatchObject({ code: 'ECONNABORTED', status: 0 });
    expect(log.error).toHaveBeenCalledWith(
      'request failed: GET /market-data/coverage',
      expect.objectContaining({
        params: { tickers: 'AAPL,NBIS' },
        timeoutMs: 30_000,
        retryable: true,
      }),
    );
    await vi.advanceTimersByTimeAsync(30_000);
    expect(log.warn).not.toHaveBeenCalled();
  });
});
