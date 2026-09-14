/**
 * Defines a global Storage before any module reads `localStorage` at import
 * time.
 *
 * zustand's persist adapter evaluates `localStorage` once, when the store is
 * created, so stubbing it in `beforeEach` is too late for state updates that
 * write through the adapter. Import this for side effects as the *first* import
 * of a test file, and storage reads at module-load see a real object.
 *
 * jsdom in this setup does not expose `localStorage` at all; see
 * `./fake-storage` for the per-test variant.
 */

const entries = new Map<string, string>();

export const storageGlobal: Storage = {
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

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: storageGlobal,
});