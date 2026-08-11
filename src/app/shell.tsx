import {
  Activity,
  Briefcase,
  ChartCandlestick,
  FlaskConical,
  GitCompareArrows,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { NavLink } from 'react-router';

import { paths } from '@/app/paths';
import logo from '@/assets/logo_dark.svg';
import { Button } from '@/components/ui/button';
import { APP_NAME, PRODUCT_NAMES } from '@/config/constants';
import { useSidebarCollapsed, useToggleSidebar } from '@/lib/ui-store';
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
      { to: paths.strategies, label: 'Strategies', icon: FlaskConical, end: false },
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

      {/*
       * The header spans the full width *above* the sidebar rather than sitting
       * beside it. Nested inside the content column, its centre would be the
       * centre of whatever space the sidebar left over — so the wordmark would
       * sit off-centre and, worse, slide sideways every time the rail was
       * collapsed. Full width means the true middle, and a fixed one.
       */}
      <div className="flex min-h-dvh flex-col">
        <AppHeader />

        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopNav />
            <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Top bar: navigation toggle on the left, wordmark centred, account on the right.
 *
 * The wordmark is absolutely positioned rather than laid out between the two
 * side slots. Centring it with flex would measure it against whatever happens
 * to sit either side, so it would drift every time the burger appeared or the
 * button label changed width — and "Log out" is wider than the burger, so it
 * would never actually be centred. Absolute keeps it locked to the true middle
 * regardless of what flanks it.
 */
function AppHeader() {
  const collapsed = useSidebarCollapsed();
  const toggleSidebar = useToggleSidebar();

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center border-b bg-card/95 backdrop-blur">
      {/*
       * Mirrors the sidebar's width and carries the same right border, so the
       * rail's vertical divider runs unbroken from the top of the page rather
       * than starting below the header. It tracks the collapse with the same
       * transition, so the line never lurches out of alignment mid-animation.
       *
       * The burger lives in here rather than in the rail itself: a row of its
       * own at the top of the sidebar cost 56px of height to show one icon.
       */}
      <div
        className={cn(
          'hidden h-full shrink-0 items-center border-r transition-[width] duration-200 md:flex',
          collapsed ? 'w-16 justify-center px-2' : 'w-56 px-4',
        )}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Menu className="size-4" aria-hidden />
        </button>
      </div>

      {/* Absolute against the header, which spans the full width — so this is
          the viewport's centre, not the centre of the space left over beside
          the rail. `pointer-events-none` keeps it from swallowing a click
          aimed at the controls it overlaps at narrow widths. */}
      <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
        <img src={logo} alt="MQS Logo" className="h-6" />
        {/* Dropped on the narrowest screens rather than allowed to collide
            with the account button. */}
        <span className="hidden truncate text-sm font-semibold sm:inline">{APP_NAME}</span>
      </div>

      <div className="ml-auto flex items-center gap-2 px-4">
        {/*
         * Placeholder. There is no auth yet — no login route, no session, and
         * no protected routes — so this deliberately does nothing rather than
         * calling an endpoint that does not exist. Wire it to a real sign-out
         * once sessions land; the session is an httpOnly cookie, so logging out
         * will have to be a server round trip, not a client-side clear.
         */}
        <Button variant="ghost" size="sm" title="Not wired up yet">
          <LogOut className="mr-2 size-4" aria-hidden />
          Log out
        </Button>
      </div>
    </header>
  );
}

/**
 * Navigation for viewports below `md`, where `Sidebar` is display:none.
 *
 * Without this the app has *no* navigation at all under 768px — every link is
 * unreachable and the only way to change page is editing the URL. A scrolling
 * row rather than a hamburger drawer: it needs no open/close state, no overlay
 * and no focus trap, and every destination stays one tap away instead of two.
 *
 * Both this and `Sidebar` render from the same `sections` array, so a new route
 * cannot appear in one and go missing from the other.
 */
function TopNav() {
  return (
    <div className="sticky top-14 z-40 border-b bg-card/95 backdrop-blur md:hidden">
      {/* The row scrolls sideways inside itself; the page body must not. */}
      <nav aria-label="Main" className="overflow-x-auto">
        <ul className="flex w-max items-center gap-1 px-2 py-2">
          {sections.flatMap((section) =>
            section.items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
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
            )),
          )}
        </ul>
      </nav>
    </div>
  );
}

/**
 * Collapses to an icon rail rather than disappearing.
 *
 * Hiding it outright would reproduce the bug `TopNav` exists to fix — no
 * navigation at all — so collapsed still shows every destination, just without
 * labels. The state is persisted by `useUiStore`, so the choice survives a
 * reload.
 */
function Sidebar() {
  const collapsed = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        // `overflow-hidden` is load-bearing: the labels are laid out at their
        // full width for the whole 200ms transition, so without it they spill
        // out of the narrowing rail and across the page on every toggle.
        'hidden shrink-0 overflow-hidden border-r bg-card transition-[width] duration-200 md:block',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Nav starts straight away — the wordmark and the toggle both live in
          `AppHeader`, so there is nothing to reserve a header row for. */}
      <nav className="space-y-6 p-3" aria-label="Main">
        {sections.map((section, sectionIndex) => (
          <div key={section.heading}>
            {collapsed ? (
              // A rule instead of the heading: the grouping is load-bearing
              // (simulated vs real money) so it must not vanish entirely.
              // Skipped on the first group, where it would double up with the
              // header's own bottom border.
              sectionIndex === 0 ? null : (
                <div className="mx-2 mb-1.5 border-t" role="presentation" />
              )
            ) : (
              <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                {section.heading}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      cn(
                        // `whitespace-nowrap` stops labels wrapping to two lines
                        // while the rail is mid-transition.
                        'flex items-center rounded-md py-2 text-sm whitespace-nowrap transition-colors',
                        collapsed ? 'justify-center px-2' : 'gap-2.5 px-3',
                        isActive
                          ? 'bg-accent font-medium text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {collapsed ? <span className="sr-only">{label}</span> : label}
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
