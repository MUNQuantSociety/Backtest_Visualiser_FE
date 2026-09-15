import '@/test/storage-global';

import { describe, expect, it } from 'vitest';

import { demoPanelsHiddenByDefault } from '@/lib/ui-store';

describe('demo panels hidden by default', () => {
  it('are visible in dev unless the env var says otherwise', () => {
    expect(demoPanelsHiddenByDefault(true, false)).toBe(false);
  });

  it('are hidden in dev when the env var is on', () => {
    expect(demoPanelsHiddenByDefault(true, true)).toBe(true);
  });

  it('are always hidden outside dev', () => {
    expect(demoPanelsHiddenByDefault(false, false)).toBe(true);
    expect(demoPanelsHiddenByDefault(false, true)).toBe(true);
  });
});