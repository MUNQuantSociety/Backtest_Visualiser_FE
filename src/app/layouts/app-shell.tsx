import { ChartCandlestick, GitCompareArrows, LayoutDashboard } from 'lucide-react';
import { type ReactNode } from 'react';
import { NavLink } from 'react-router';

import { paths } from '@/app/router/paths';
import { APP_NAME } from '@/config/constants';
import { cn } from '@/lib/utils';

const navigation = [
  { to: paths.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: paths.backtests, label: 'Backtests', icon: ChartCandlestick, end: false },
  { to: paths.compare, label: 'Compare', icon: GitCompareArrows, end: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only bg-primary text-primary-foreground focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r bg-card md:block">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <ChartCandlestick className="size-5 text-primary" aria-hidden />
        <span className="truncate text-sm font-semibold">{APP_NAME}</span>
      </div>
      <nav className="space-y-1 p-3" aria-label="Main">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )
            }
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
