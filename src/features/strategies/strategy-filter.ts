import type { Strategy, StrategyOrigin, StrategyStatus } from './types';

export type StrategyFilter = 'all' | StrategyStatus;

export function isStrategyFilter(value: string | null): value is StrategyFilter {
  return value === 'all' || value === 'active' || value === 'draft' || value === 'archived';
}

/**
 * Palette index for a strategy: its position among the active ones, so the
 * colour it gets in the Library is the colour it has on the dashboard's book
 * chart. Drafts and archived strategies have no series anywhere, so no colour.
 */
export function strategyColorIndex(strategy: Strategy, all: readonly Strategy[]): number | null {
  if (strategy.status !== 'active') return null;
  const index = all.filter((s) => s.status === 'active').findIndex((s) => s.id === strategy.id);
  return index === -1 ? null : index;
}

/** Section order and headings wherever strategies are grouped by owner. */
const ORIGIN_GROUPS = [
  { origin: 'own', label: 'My strategies' },
  { origin: 'community', label: 'Community' },
  { origin: 'builtin', label: 'Built-in' },
] as const satisfies readonly { origin: StrategyOrigin; label: string }[];

export interface OriginGroup<T> {
  origin: StrategyOrigin;
  label: string;
  items: T[];
}

/**
 * Splits strategies into mine / community / built-in, in that order, keeping
 * the input order inside each group. Empty groups are left out so a caller
 * never renders a heading with nothing under it.
 */
export function groupByOrigin<T extends { origin: StrategyOrigin }>(
  strategies: readonly T[],
): OriginGroup<T>[] {
  return ORIGIN_GROUPS.map(({ origin, label }) => ({
    origin,
    label,
    items: strategies.filter((strategy) => strategy.origin === origin),
  })).filter((group) => group.items.length > 0);
}
