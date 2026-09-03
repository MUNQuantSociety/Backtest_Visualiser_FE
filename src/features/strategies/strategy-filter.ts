import type { Strategy, StrategyStatus } from './types';

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
