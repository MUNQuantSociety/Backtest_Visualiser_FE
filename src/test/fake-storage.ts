import { vi } from 'vitest';

/**
 * jsdom in this setup does not expose a usable `localStorage` global, so
 * storage-backed code is exercised against an in-memory <Storage> instead.
 * Stubbing the same global the browser provides keeps the code under test
 * honest while staying deterministic and quota-free.
 */
export function installFakeStorage(): Storage {
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
  return storage;
}