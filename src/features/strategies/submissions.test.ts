import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acknowledgeSubmission,
  forgetSubmission,
  readSubmissions,
  rememberSubmission,
  resolveSubmission,
  SUBMISSIONS_STORAGE_KEY,
} from './submissions';

/**
 * The store exists so a validation outcome survives a reload and a closed
 * window. These assert exactly that, plus the cases where `localStorage` is
 * not usable at all — a private window or blocked site data must not take the
 * app down with it.
 */

/**
 * This jsdom setup provides no `localStorage` at all — a bare reference to it
 * throws `ReferenceError`, which is the same shape as a private window
 * refusing access, and the reason every read and write in the store is
 * wrapped. So the working case has to be supplied here.
 */
function installStorage(): void {
  const entries = new Map<string, string>();
  const storage: Storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  };
  vi.stubGlobal('localStorage', storage);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  installStorage();
});

const ENTRY = { strategyKey: 'user-test-b0a184b1', name: 'test', validationRunId: 'run-1' };

function remember(overrides: Partial<typeof ENTRY> = {}) {
  return rememberSubmission({
    ...ENTRY,
    ...overrides,
    submittedAt: new Date().toISOString(),
  });
}

describe('strategy submission store', () => {
  it('remembers an upload as pending, and reads it back after a reload', () => {
    remember();

    // A fresh read is what a reload does: nothing is held in memory.
    const [entry] = readSubmissions();
    expect(entry).toMatchObject({
      strategyKey: 'user-test-b0a184b1',
      name: 'test',
      validationRunId: 'run-1',
      outcome: 'pending',
      acknowledged: false,
    });
  });

  it('keeps a failure and its error across a reload', () => {
    remember();
    resolveSubmission(
      'user-test-b0a184b1',
      'failed',
      "NameError: name 'BasePortfolio' is not defined",
    );

    const [entry] = readSubmissions();
    expect(entry?.outcome).toBe('failed');
    // The engine's words are what the banner shows, so they have to persist
    // too — re-fetching them needs the run id and a live backend.
    expect(entry?.errorMessage).toMatch(/BasePortfolio/);
  });

  it('dismissing keeps the draft but clears the notice', () => {
    remember();
    resolveSubmission(ENTRY.strategyKey, 'failed', 'boom');
    acknowledgeSubmission(ENTRY.strategyKey);

    const [entry] = readSubmissions();
    expect(entry?.acknowledged).toBe(true);
    // Still recorded: the Library needs it to show the draft at all.
    expect(entry?.outcome).toBe('failed');
  });

  it('re-submitting the same key replaces the old attempt', () => {
    remember();
    resolveSubmission(ENTRY.strategyKey, 'failed', 'boom');
    remember({ validationRunId: 'run-2' });

    const entries = readSubmissions();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ validationRunId: 'run-2', outcome: 'pending' });
    expect(entries[0]?.errorMessage).toBeNull();
  });

  it('forgets on request', () => {
    remember();
    forgetSubmission(ENTRY.strategyKey);
    expect(readSubmissions()).toEqual([]);
  });

  it('drops entries older than a week rather than polling them forever', () => {
    const stale = [
      { ...ENTRY, submittedAt: new Date(Date.now() - 8 * 86_400_000).toISOString() },
      { ...ENTRY, strategyKey: 'fresh', submittedAt: new Date().toISOString() },
    ];
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(stale));

    expect(readSubmissions().map((entry) => entry.strategyKey)).toEqual(['fresh']);
  });

  it('survives corrupt or foreign stored data', () => {
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, 'not json at all');
    expect(readSubmissions()).toEqual([]);

    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify([{ nope: true }]));
    expect(readSubmissions()).toEqual([]);
  });

  it('never throws when storage itself is unavailable', () => {
    // A private window, blocked site data, or a thumbnail capture.
    vi.stubGlobal('localStorage', undefined);

    expect(readSubmissions()).toEqual([]);
    expect(() => remember()).not.toThrow();
  });
});
