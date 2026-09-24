import type { TickerIndicators } from './types';

/**
 * Deterministic market fixtures, keyed by ticker so the same ticker shows the
 * same numbers on every panel and every reload. Same xorshift32 as the other
 * fixture files.
 */

function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

function seedFrom(text: string): number {
  return [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 11);
}

/**
 * Anchored to the real clock, not a fixed date. A pinned anchor made every
 * article read "412d" once the calendar moved on, which looks like a bug in
 * the time formatting rather than what it is — old demo data. Content stays
 * deterministic; only the timestamps track today.
 */
const NOW = Date.now();
const AS_OF = new Date(NOW).toISOString().slice(0, 10);

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export function fixtureIndicators(tickers: readonly string[]): TickerIndicators[] {
  return tickers.map((ticker) => {
    const random = makeRandom(seedFrom(ticker));
    const last = round(20 + random() * 480, 2);
    const rsi14 = round(22 + random() * 58, 1);
    const macdHistogram = round((random() - 0.45) * last * 0.012, 2);
    const momentum20d = round((random() - 0.4) * 0.16, 4);
    const sentiment7d = round((random() - 0.45) * 1.2, 2);
    return {
      ticker,
      last,
      rsi14,
      macdHistogram,
      smaRegime: random() < 0.62 ? 'above' : 'below',
      momentum20d,
      sentiment7d: Math.max(-1, Math.min(1, sentiment7d)),
      sentimentDelta7d: round((random() - 0.5) * 0.4, 2),
      asOf: AS_OF,
    };
  });
}
