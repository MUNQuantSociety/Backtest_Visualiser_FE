import { beforeEach, describe, expect, it } from 'vitest';

import { installFakeStorage } from '@/test/fake-storage';

import {
  deleteRunPreset,
  listRunPresets,
  saveRunPreset,
  type RunPresetConfig,
} from './run-presets';

function snapshot(overrides: Partial<RunPresetConfig> = {}): RunPresetConfig {
  return {
    strategyKey: 'portfolio_1',
    runName: 'Vol Momentum 2025-07-15 to 2026-07-15',
    universe: ['AAPL'],
    startDate: '2025-07-15',
    endDate: '2026-07-15',
    capital: '100000',
    slippageBps: '5',
    commission: '0.005',
    paramValues: { lookback: '20' },
    gateEnabled: false,
    gateThreshold: -0.25,
    ...overrides,
  };
}

beforeEach(() => {
  installFakeStorage();
});

describe('saveRunPreset', () => {
  it('round-trips a snapshot through the store', () => {
    saveRunPreset('My preset', snapshot());

    const [loaded] = listRunPresets();
    expect(loaded).toMatchObject({
      name: 'My preset',
      config: snapshot(),
    });
    expect(typeof loaded?.savedAt).toBe('string');
  });

  it('replaces an existing preset with the same name instead of duplicating it', () => {
    const first = saveRunPreset('My preset', snapshot({ slippageBps: '5' }));
    expect(first).not.toBeNull();
    const second = saveRunPreset('My preset', snapshot({ slippageBps: '8' }));

    const all = listRunPresets();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(second?.id);
    expect(all[0]).toMatchObject({ name: 'My preset' });
    expect(all[0]?.config).toMatchObject({ slippageBps: '8' });
  });

  it('keeps distinct names as separate presets', () => {
    saveRunPreset('Window A', snapshot({ endDate: '2025-01-01' }));
    saveRunPreset('Window B', snapshot({ endDate: '2026-01-01' }));

    expect(listRunPresets()).toHaveLength(2);
  });

  it('refuses a blank name', () => {
    expect(saveRunPreset('   ', snapshot())).toBeNull();
    expect(listRunPresets()).toHaveLength(0);
  });
});

describe('listRunPresets', () => {
  it('reads an empty store as an empty list', () => {
    expect(listRunPresets()).toEqual([]);
  });

  it('reads corrupt JSON as an empty list', () => {
    localStorage.setItem('mqs:run-presets:v1', '{not json');
    expect(listRunPresets()).toEqual([]);
  });

  it('reads a non-array payload as an empty list', () => {
    localStorage.setItem('mqs:run-presets:v1', JSON.stringify({ name: 'oops' }));
    expect(listRunPresets()).toEqual([]);
  });

  it('skips malformed entries instead of failing the whole list', () => {
    localStorage.setItem(
      'mqs:run-presets:v1',
      JSON.stringify([
        { id: 'bad', name: 'Broken', savedAt: '2026-01-01T00:00:00Z', config: {} },
        saveRunPreset('Fine', snapshot()),
      ]),
    );
    expect(listRunPresets()).toEqual([expect.objectContaining({ name: 'Fine' })]);
  });
});

describe('deleteRunPreset', () => {
  it('removes only the named preset', () => {
    saveRunPreset('Keep', snapshot());
    saveRunPreset('Drop', snapshot({ endDate: '2025-01-01' }));

    deleteRunPreset('drop');

    expect(listRunPresets().map((preset) => preset.name)).toEqual(['Keep']);
  });

  it('leaves an empty store alone', () => {
    expect(() => deleteRunPreset('missing')).not.toThrow();
    expect(listRunPresets()).toEqual([]);
  });
});