import { useEffect, type ReactNode } from 'react';

import { useTheme } from '@/lib/ui-store';

/**
 * Applies the `dark` class to <html>, which is what both Tailwind's dark
 * variant and the chart palette key off. Tracks the OS setting while the
 * user's preference is "system".
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches);
      root.classList.toggle('dark', isDark);
      root.style.colorScheme = isDark ? 'dark' : 'light';
    };

    apply();

    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
    };
  }, [theme]);

  return children;
}
