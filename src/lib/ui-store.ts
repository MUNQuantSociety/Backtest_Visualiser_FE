import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { STORAGE_KEYS } from '@/config/constants';

/**
 * Client-only UI state.
 *
 * Server data belongs in React Query, not here. Zustand is for state the
 * backend knows nothing about: theme, sidebar, which backtests are selected
 * for comparison.
 */

export type Theme = 'light' | 'dark' | 'system';

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  /** IDs currently pinned for side-by-side comparison. */
  comparisonIds: string[];

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  toggleComparison: (id: string) => void;
  clearComparison: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarCollapsed: false,
      comparisonIds: [],

      setTheme: (theme) => {
        set({ theme });
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
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
    }),
    {
      name: STORAGE_KEYS.theme,
      // Comparison selections are per-session; only persist real preferences.
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);

/* Selector hooks. Subscribing to one slice stops every consumer from
   re-rendering when an unrelated field changes. */
export const useTheme = () => useUiStore((state) => state.theme);
export const useSetTheme = () => useUiStore((state) => state.setTheme);
export const useSidebarCollapsed = () => useUiStore((state) => state.sidebarCollapsed);
export const useToggleSidebar = () => useUiStore((state) => state.toggleSidebar);
