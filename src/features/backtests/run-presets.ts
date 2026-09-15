import { z } from 'zod';

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

// Every field the form re-applies is checked, not just the identifying ones:
// the store is plain localStorage, so a hand-edited or half-written row is a
// real input, and one that passes here is later read without guards.
const runPresetConfigSchema = z.object({
  strategyKey: z.string(),
  runName: z.string(),
  universe: z.array(z.string()),
  startDate: z.string(),
  endDate: z.string(),
  capital: z.string(),
  slippageBps: z.string(),
  commission: z.string(),
  paramValues: z.record(z.string(), z.union([z.string(), z.boolean()])),
  gateEnabled: z.boolean(),
  gateThreshold: z.number(),
});
export type RunPresetConfig = z.infer<typeof runPresetConfigSchema>;

const runPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  savedAt: z.string(),
  config: runPresetConfigSchema,
});
export type RunPreset = z.infer<typeof runPresetSchema>;

const STORAGE_KEY = 'mqs:run-presets:v1';

/** Current presets; a corrupt or unreadable store reads as empty. */
export function listRunPresets(): RunPreset[] {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // One bad row must not hide the good ones, so each is parsed on its own.
    return parsed.flatMap((entry: unknown) => {
      const result = runPresetSchema.safeParse(entry);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

/**
 * A preset id derived from its name, so re-saving a name replaces it. Case is
 * kept: the panel promises that only the *same* name replaces, and folding
 * "Momentum Test" into "momentum test" would silently delete the first.
 */
function presetId(name: string): string {
  return name.trim().replace(/\s+/g, '-');
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
