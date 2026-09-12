import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveBlob } from './download';

/**
 * jsdom implements neither half of the object-URL API, so both are stubbed
 * here rather than in `src/test/setup.ts`: this is the only code in the app
 * that downloads a file, and a global stub would quietly satisfy anything else
 * that started calling it.
 */
const createObjectURL = vi.fn(() => 'blob:mock-url');
const revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('saveBlob', () => {
  it('clicks an anchor carrying the blob and the chosen filename', () => {
    const blob = new Blob(['date,equity\n'], { type: 'text/csv' });
    const clicks: { href: string; download: string; attached: boolean }[] = [];

    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        // Captured mid-click: the assertions that matter are what the anchor
        // carried *at the moment it fired*, since it is removed right after.
        clicks.push({
          href: this.href,
          download: this.download,
          attached: this.isConnected,
        });
      });

    saveBlob(blob, '80cb98a1-equity.csv');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicks).toEqual([
      { href: 'blob:mock-url', download: '80cb98a1-equity.csv', attached: true },
    ]);

    click.mockRestore();
  });

  it('leaves no anchor behind, and revokes the url once the click is through', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    saveBlob(new Blob(['{}']), 'report.json');

    // Removed synchronously; the object URL outlives it by a tick because
    // Safari reads the href after the click returns.
    expect(document.querySelectorAll('a')).toHaveLength(0);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    click.mockRestore();
  });
});
