import type { BacktestDetail } from './types';

/**
 * The tickers a run traded.
 *
 * Every run the backend saves records its universe in `parameters.universe`.
 * Older reports may not carry it; a single-ticker run still names its ticker
 * in `symbol`, while `MULTI` says only that there were several.
 */
export function runUniverse(run: Pick<BacktestDetail, 'parameters' | 'symbol'>): string[] {
  const universe = run.parameters['universe'];
  if (Array.isArray(universe)) {
    const tickers = universe.filter(
      (ticker): ticker is string => typeof ticker === 'string' && ticker.trim() !== '',
    );
    if (tickers.length > 0) return tickers.map((ticker) => ticker.trim().toUpperCase());
  }
  return run.symbol && run.symbol !== 'MULTI' ? [run.symbol.toUpperCase()] : [];
}
