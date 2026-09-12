import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

/*
 * Testing Library's default `findBy*` budget is 1000ms, and that is too tight
 * here. Vitest runs the suite's files in parallel, so the first render in a
 * file pays module init while competing with ten other workers — and on a
 * machine also running a dev server and the backend, the first
 * `findByRole` in run-backtest-form.test.tsx overshot 1000ms in roughly one
 * run in five while the element itself was never actually missing.
 *
 * A longer budget costs nothing when the element appears (the query resolves
 * as soon as it does) and still fails an element that genuinely never arrives.
 */
configure({ asyncUtilTimeout: 5000 });

// jsdom implements neither of these, and both charting libraries reach for
// them on mount. Stubbing here keeps every chart test from repeating it.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});
