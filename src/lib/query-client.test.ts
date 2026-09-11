import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { createQueryClient } from '@/lib/query-client';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('@/lib/logger', () => ({ createLogger: () => log }));
afterEach(() => vi.clearAllMocks());

describe('query lifecycle logging', () => {
  it('identifies ticker-specific retries and final failure without reporting success', async () => {
    const client = createQueryClient();
    const queryKey = ['backtests', 'coverage', 'portfolio_1', ['AAPL', 'NBIS']];
    const queryFn = vi.fn(() => Promise.reject(new ApiError('unavailable', 503, 'HTTP_503')));
    await expect(client.fetchQuery({ queryKey, queryFn, retryDelay: 0 })).rejects.toThrow(
      'unavailable',
    );
    expect(queryFn).toHaveBeenCalledTimes(3);
    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledWith(
      'query retry scheduled: backtests/coverage/portfolio_1',
      expect.objectContaining({ queryKey, nextAttempt: 2 }),
    );
    expect(log.error).toHaveBeenCalledWith(
      'query failed: backtests/coverage/portfolio_1',
      expect.objectContaining({ queryKey, attempts: 3 }),
    );
    expect(log.info.mock.calls.some(([message]) => String(message).includes('resolved'))).toBe(
      false,
    );
    client.clear();
  });

  it.each(['ECONNABORTED', 'ETIMEDOUT'])(
    'does not restart a full request timeout (%s)',
    async (code) => {
      const client = createQueryClient();
      const queryFn = vi.fn(() => Promise.reject(new ApiError('Timed out', 0, code)));
      await expect(
        client.fetchQuery({ queryKey: ['strategies', 'list'], queryFn, retryDelay: 0 }),
      ).rejects.toThrow('Timed out');
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(log.warn).not.toHaveBeenCalled();
      client.clear();
    },
  );
});
