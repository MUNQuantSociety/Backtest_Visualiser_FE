/**
 * Named snapshots of the run configuration, kept in localStorage.
 *
 * There is no preset endpoint yet, so a preset is a purely client-side thing:
 * it captures what the run form holds — strategy, universe, window, costs and
 * parameters — and re-applies it to the form. Keeping it in the browser means
 * nothing in the backend changes and the feature works in the dev build the
 * same way it will in production; a future `/presets` API can replace the store
 * behind these same functions.
 */

export interface RunPresetConfig {
  strategyKey: string;
  runName: string;
  universe: string[];
  startDate: string;
  endDate: string;
  capital: string;
  slippageBps: string;
  commission: string;
  paramValues: Record<string, string | boolean>;
  gateEnabled: boolean;
  gateThreshold: number;
}

export interface RunPreset {
  id: string;
  name: string;
  savedAt: string;
  config: RunPresetConfig;
}

const STORAGE_KEY = 'mqs:run-presets:v1';

/** Current presets; a corrupt or unreadable store reads as empty. */
export function listRunPresets(): RunPreset[] {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRunPreset);
  } catch {
    return [];
  }
}

function isRunPreset(value: unknown): value is RunPreset {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return false;
  if (typeof record.savedAt !== 'string') return false;
  const config = record.config as Record<string, unknown> | null;
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof config.strategyKey === 'string' &&
    typeof config.startDate === 'string' &&
    typeof config.endDate === 'string'
  );
}

/** A preset id derived from its name, so re-saving a name replaces it. */
function presetId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Store a named snapshot. Re-saving an existing name replaces that preset so
 * the list does not fill with duplicates; returns the stored preset, or null
 * when the browser store refused it (quota, private mode).
 */
export function saveRunPreset(name: string, config: RunPresetConfig): RunPreset | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const preset: RunPreset = {
    id: presetId(trimmed),
    name: trimmed,
    savedAt: new Date().toISOString(),
    config: {
      ...config,
      universe: [...config.universe],
      paramValues: { ...config.paramValues },
    },
  };
  const rest = listRunPresets().filter((existing) => existing.id !== preset.id);
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify([...rest, preset]));
    return preset;
  } catch {
    return null;
  }
}

/** Remove a saved preset. A refused write only leaves a stale row behind. */
export function deleteRunPreset(id: string): void {
  try {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(listRunPresets().filter((preset) => preset.id !== id)),
    );
  } catch {
    // Nothing to signal; the list is always re-read from the store.
  }
}