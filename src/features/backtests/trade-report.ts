import type { BacktestDetail } from './types';

/** Fill counts come from execution records, never from paired trade lots. */
export function recordedFillCount(metadata: BacktestDetail['reportMetadata']): number | null {
  for (const value of [metadata?.execution?.fillCount, metadata?.['fill_count']]) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  }
  return null;
}
