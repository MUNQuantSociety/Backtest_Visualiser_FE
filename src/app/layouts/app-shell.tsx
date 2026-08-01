import {
  Activity,
  Briefcase,
  ChartCandlestick,
  GitCompareArrows,
  LayoutDashboard,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { NavLink } from 'react-router';

import { paths } from '@/app/router/paths';
import logo from '@/assets/logo_dark.svg';
import { APP_NAME, PRODUCT_NAMES } from '@/config/constants';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** `end` stops a parent route staying highlighted while a child is active. */
  end: boolean;
}

interface NavSection {
  heading: string;
  items: readonly NavItem[];
}

/**
 * One shell, two products. The section headings are the whole point: a member
 * looking at a drawdown chart must know instantly whether it came from a
 * simulation or from real fills, and grouped navigation is the cheapest place
 * to establish that.
 */
const sections: readonly NavSection[] = [
  {
    heading: PRODUCT_NAMES.backtests,
    items: [
      { to: paths.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: paths.backtests, label: 'Backtests', icon: ChartCandlestick, end: false },
      { to: paths.compare, label: 'Compare', icon: GitCompareArrows, end: false },
    ],
  },
  {
    heading: PRODUCT_NAMES.live,
    items: [
      { to: paths.live, label: 'Live Trading', icon: Activity, end: true },
      { to: paths.portfolios, label: 'Portfolios', icon: Briefcase, end: false },
      { to: paths.log, label: 'Log', icon: ScrollText, end: false },
      { to: paths.settings, label: 'Settings', icon: Settings, end: false },
    ],
  },
];

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
        <img src={logo} alt="MQS Logo" style={{ height: 1.5 + 'rem' }} />
        <span className="truncate text-sm font-semibold">{APP_NAME}</span>
      </div>

      <nav className="space-y-6 p-3" aria-label="Main">
        {sections.map((section) => (
          <div key={section.heading}>
            <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
              {section.heading}
            </p>
            <ul className="space-y-1">
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
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
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
