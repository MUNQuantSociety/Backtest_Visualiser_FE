import { useSyncExternalStore } from 'react';

import { readChartPalette, type ChartPalette } from '@/lib/chart-theme';

let cached: ChartPalette | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  cached = null;
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // Re-read the palette when the `dark` class is toggled on <html>.
  const observer = new MutationObserver(emit);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  return () => {
    listeners.delete(listener);
    observer.disconnect();
  };
}

function getSnapshot(): ChartPalette {
  cached ??= readChartPalette();
  return cached;
}

/**
 * Chart colours that stay in sync with the active theme.
 * Cached between reads because `getComputedStyle` forces layout.
 */
export function useChartPalette(): ChartPalette {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
