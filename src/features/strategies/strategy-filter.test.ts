import { describe, expect, it } from 'vitest';

import { groupByOrigin } from './strategy-filter';
import type { StrategyOrigin } from './types';

const item = (id: string, origin: StrategyOrigin) => ({ id, origin });

describe('groupByOrigin', () => {
  it('orders groups mine, community, built-in', () => {
    const groups = groupByOrigin([item('b', 'builtin'), item('c', 'community'), item('o', 'own')]);

    expect(groups.map((group) => group.label)).toEqual(['My strategies', 'Community', 'Built-in']);
  });

  it('keeps the input order within a group', () => {
    const groups = groupByOrigin([item('o2', 'own'), item('b', 'builtin'), item('o1', 'own')]);

    expect(groups[0]?.items.map((strategy) => strategy.id)).toEqual(['o2', 'o1']);
  });

  it('omits groups with no strategies', () => {
    const groups = groupByOrigin([item('b', 'builtin')]);

    expect(groups.map((group) => group.origin)).toEqual(['builtin']);
  });

  it('returns no groups for an empty list', () => {
    expect(groupByOrigin([])).toEqual([]);
  });
});
