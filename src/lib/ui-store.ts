import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { STORAGE_KEYS } from '@/config/constants';
import { env } from '@/config/env';

/**
 * Client-only UI state.
 *
 * Server data belongs in React Query, not here. Zustand is for state the
 * backend knows nothing about: theme, sidebar, which backtests are selected
 * for comparison.
 */

export type Theme = 'light' | 'dark' | 'system';

/** How far back the dashboard's book panels look. */
export type DashboardPeriod = '1y' | '2y' | '5y' | 'max';

/** What the dashboard's top runs are measured against: SPY, or each run's own buy-and-hold. */
export type DashboardBenchmark = 'spy' | 'buyHold';

/**
 * Demo panels are a development aid: visible in dev, hidden everywhere else.
 * The dev-only env var can additionally start them hidden inside dev.
 */
export function demoPanelsHiddenByDefault(isDev: boolean, devHideDemoPanels: boolean): boolean {
  return !isDev || devHideDemoPanels;
}

interface UiState {
  theme: Theme;
  dashboardPeriod: DashboardPeriod;
  dashboardBenchmark: DashboardBenchmark;
  /** IDs currently pinned for side-by-side comparison. */
  comparisonIds: string[];
  /** When true, cards marked with <DemoBadge /> are hidden. */
  hideDemoPanels: boolean;

  setTheme: (theme: Theme) => void;
  setDashboardPeriod: (period: DashboardPeriod) => void;
  setDashboardBenchmark: (benchmark: DashboardBenchmark) => void;
  toggleComparison: (id: string) => void;
  clearComparison: () => void;
  setHideDemoPanels: (hide: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      dashboardPeriod: '2y',
      dashboardBenchmark: 'spy',
      comparisonIds: [],
      // Seeds the store on first visit. Demo panels are dev-only: hidden in
      // production, visible in dev, optionally hidden there by the env var. A
      // persisted toggle choice wins in dev.
      hideDemoPanels: demoPanelsHiddenByDefault(env.isDev, env.devHideDemoPanels),

      setTheme: (theme) => {
        set({ theme });
      },

      setDashboardPeriod: (period) => {
        set({ dashboardPeriod: period });
      },

      setDashboardBenchmark: (benchmark) => {
        set({ dashboardBenchmark: benchmark });
      },

      toggleComparison: (id) => {
        set((state) => ({
          comparisonIds: state.comparisonIds.includes(id)
            ? state.comparisonIds.filter((existing) => existing !== id)
            : [...state.comparisonIds, id],
        }));
      },

      clearComparison: () => {
        set({ comparisonIds: [] });
      },

      setHideDemoPanels: (hide) => {
        set({ hideDemoPanels: hide });
      },
    }),
    {
      name: STORAGE_KEYS.theme,
      // Comparison selections are per-session; only persist real preferences.
      partialize: (state) =>
        env.isProd
          ? {
              theme: state.theme,
              dashboardPeriod: state.dashboardPeriod,
              dashboardBenchmark: state.dashboardBenchmark,
            }
          : {
              theme: state.theme,
              dashboardPeriod: state.dashboardPeriod,
              dashboardBenchmark: state.dashboardBenchmark,
              hideDemoPanels: state.hideDemoPanels,
            },
      // A production build never shows demo panels, even if a dev session left
      // a `show` choice in the same origin's storage.
      merge: (persistedState, currentState) => {
        const merged = {
          ...currentState,
          ...(persistedState as Partial<UiState>),
        };
        return env.isProd ? { ...merged, hideDemoPanels: true } : merged;
      },
    },
  ),
);

/* Selector hooks. Subscribing to one slice stops every consumer from
   re-rendering when an unrelated field changes. */
export const useTheme = () => useUiStore((state) => state.theme);
export const useSetTheme = () => useUiStore((state) => state.setTheme);
export const useDashboardPeriod = () => useUiStore((state) => state.dashboardPeriod);
export const useSetDashboardPeriod = () => useUiStore((state) => state.setDashboardPeriod);
export const useDashboardBenchmark = () => useUiStore((state) => state.dashboardBenchmark);
export const useSetDashboardBenchmark = () => useUiStore((state) => state.setDashboardBenchmark);
export const useHideDemoPanels = () => useUiStore((state) => state.hideDemoPanels);
export const useSetHideDemoPanels = () => useUiStore((state) => state.setHideDemoPanels);
