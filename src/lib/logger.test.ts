import { afterEach, describe, expect, it, vi } from 'vitest';

import { sanitiseLogData, sanitiseLogUrl } from '@/lib/log-data';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('diagnostic log delivery', () => {
  it('retains failed batches, retries in order, and does not treat a SPA response as delivery', async () => {
    vi.resetModules();
    vi.stubEnv('MODE', 'development');
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const listeners = vi.spyOn(window, 'addEventListener');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('SPA fallback', { status: 200 }))
      .mockResolvedValue(
        new Response(null, { status: 204, headers: { 'X-Client-Log-Sink': 'ready' } }),
      );
    vi.stubGlobal('fetch', fetch);
    const { createLogger } = await import('@/lib/logger');
    const log = createLogger('test');
    log.info('first step', { password: 'do-not-print', tickers: ['AAPL', 'NBIS'] });
    await vi.advanceTimersByTimeAsync(200);
    expect(warning).toHaveBeenCalledOnce();
    log.info('second step');
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch).toHaveBeenCalledTimes(2);
    const options = fetch.mock.calls[1]![1] as RequestInit;
    if (typeof options.body !== 'string') throw new Error('Expected a JSON log batch');
    const entries = JSON.parse(options.body) as Array<{ message: string; data: unknown }>;
    expect(entries.map((entry) => entry.message)).toEqual(['first step', 'second step']);
    expect(entries[0]!.data).toEqual({ password: '[redacted]', tickers: ['AAPL', 'NBIS'] });
    expect(options.body).not.toContain('do-not-print');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [event, listener] of listeners.mock.calls)
      window.removeEventListener(event, listener);
  });

  it('preserves error details, handles cycles and bigint, and redacts nested credentials', () => {
    const error = Object.assign(new Error('coverage timed out'), {
      code: 'ECONNABORTED',
      details: { token: 'hidden' },
    });
    const value: Record<string, unknown> = { error, count: 10n, apiKey: 'hidden' };
    value.self = value;
    const result = sanitiseLogData(value);
    expect(result).toMatchObject({
      count: '10',
      apiKey: '[redacted]',
      self: '[circular]',
      error: {
        message: 'coverage timed out',
        code: 'ECONNABORTED',
        details: { token: '[redacted]' },
      },
    });
    expect(JSON.stringify(result)).not.toContain('hidden');
    expect(sanitiseLogUrl('https://user:pass@example.com/api?token=hidden&tickers=AAPL')).toBe(
      'https://example.com/api?token=%5Bredacted%5D&tickers=AAPL',
    );
  });
});
