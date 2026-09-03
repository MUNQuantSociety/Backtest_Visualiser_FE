import type { NewsArticle, TickerIndicators } from './types';

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

const SOURCES = ['Reuters', 'Bloomberg', 'FT', 'WSJ', 'CNBC', 'Barron’s'];

const TEMPLATES = [
  '{t} beats on revenue, guides above consensus for the second half',
  'Analysts trim {t} price targets after margin commentary',
  '{t} expands buyback as free cash flow climbs',
  'Regulators open inquiry into {t} pricing practices',
  '{t} shares slip as sector rotation favours defensives',
  'Options activity in {t} points to a larger move around earnings',
  '{t} raises dividend; payout ratio still below peers',
  'Supply chain update from {t} eases near-term concerns',
];

export function fixtureNews(tickers: readonly string[], limit: number): NewsArticle[] {
  const random = makeRandom(seedFrom(tickers.join(',')));
  const pool = tickers.length > 0 ? tickers : ['SPY'];
  const pick = () => pool[Math.floor(random() * pool.length)] ?? 'SPY';
  const items: NewsArticle[] = [];
  for (let i = 0; i < limit; i += 1) {
    const ticker = pick();
    const template = TEMPLATES[Math.floor(random() * TEMPLATES.length)] ?? '{t}';
    const hoursAgo = Math.floor(random() * 70);
    const publishedAt = new Date(NOW - hoursAgo * 3_600_000).toISOString();
    const positive = /beats|expands|raises|eases/.test(template);
    const score = round((positive ? 0.25 : -0.3) + (random() - 0.5) * 0.6, 2);
    items.push({
      id: `news-${String(i + 1)}`,
      source: SOURCES[Math.floor(random() * SOURCES.length)] ?? 'Reuters',
      publishedAt,
      headline: template.replace('{t}', ticker),
      tickers: random() < 0.25 ? [ticker, pick()] : [ticker],
      score: Math.max(-1, Math.min(1, score)),
    });
  }
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
