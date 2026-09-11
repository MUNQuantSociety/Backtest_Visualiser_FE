import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe('temporary development owner configuration', () => {
  it('accepts an existing account UUID in development', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_DEV_USER_ID', '76125fb2-45a8-4ff5-9195-3bb0dc092c91');
    const { env } = await import('./env');
    expect(env.devUserId).toBe('76125fb2-45a8-4ff5-9195-3bb0dc092c91');
  });

  it.each(['', undefined])(
    'leaves the override disabled when empty or absent (%s)',
    async (value) => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('VITE_DEV_USER_ID', value);
      const { env } = await import('./env');
      expect(env.devUserId).toBeUndefined();
    },
  );

  it('rejects a malformed UUID before sending requests', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_DEV_USER_ID', 'temporary-user');
    await expect(import('./env')).rejects.toThrow('VITE_DEV_USER_ID');
  });

  it('ignores the override in a production build', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_DEV_USER_ID', 'temporary-user');
    const { env } = await import('./env');
    expect(env.devUserId).toBeUndefined();
  });
});
