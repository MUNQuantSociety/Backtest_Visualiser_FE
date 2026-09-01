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
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';

import { paths } from '@/app/paths';
import logo from '@/assets/logo_dark.svg';
import { Button } from '@/components/ui/button';
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

/**
 * The rail's open state, remembered between visits.
 *
 * It is a deliberate choice the member made by clicking the button, not a
 * transient hover, so forgetting it on every reload would make them re-make it
 * on every reload. Reads and writes are guarded: a private window, blocked
 * site data, or a thumbnail capture all throw on `localStorage` access rather
 * than returning null.
 */
const NAV_STORAGE_KEY = 'mqs.nav-expanded';

function readStoredNavExpanded(): boolean {
  try {
    const stored = localStorage.getItem(NAV_STORAGE_KEY);
    // Open by default: the labels are the point of a fixed rail, and someone
    // who wants the width back has a button to take it.
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

function storeNavExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(NAV_STORAGE_KEY, String(expanded));
  } catch {
    // Not being able to remember the preference is not worth breaking a click.
  }
}

/** The id the header's button points at, so the two stay in step. */
const SIDEBAR_ID = 'app-sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  /*
   * The open flag lives here rather than inside `Sidebar` because the header
   * carries the top of the rail's right border. Kept local to `Sidebar` the
   * rail would widen while the header's block stayed 64px, and the divider
   * would visibly jog at the header seam. Both read the same flag, so the line
   * stays straight. The header also owns the button that flips it.
   */
  const [navExpanded, setNavExpanded] = useState(readStoredNavExpanded);

  function toggleNav() {
    setNavExpanded((open) => {
      storeNavExpanded(!open);
      return !open;
    });
  }

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
        <AppHeader navExpanded={navExpanded} onToggleNav={toggleNav} />

        <div className="flex min-h-0 flex-1">
          <Sidebar expanded={navExpanded} />
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
 * Top bar: wordmark centred, account on the right.
 *
 * The wordmark is absolutely positioned rather than laid out between the two
 * side slots. Centring it with flex would measure it against whatever happens
 * to sit either side, so it would drift every time a control appeared or a
 * button label changed width. Absolute keeps it locked to the true middle
 * regardless of what flanks it.
 */
function AppHeader({
  navExpanded,
  onToggleNav,
}: {
  navExpanded: boolean;
  onToggleNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center border-b bg-card/95 backdrop-blur">
      {/*
       * Mirrors the rail's width and carries the same right border, so the
       * divider runs unbroken from the top of the page rather than starting
       * below the header. It animates over the same duration as the rail, so
       * the line never lurches out of alignment mid-toggle.
       */}
      <div
        className={cn(
          'hidden h-full shrink-0 items-center border-r transition-[width] duration-200 md:flex',
          navExpanded ? 'w-56' : 'w-16',
        )}
      >
        {/*
         * The button sits in the rail's own column rather than beside the
         * wordmark, so it lines up with the thing it controls at both widths.
         * `justify-center` when collapsed keeps it on the same centre line as
         * the icons below it, which is the axis the eye follows down the rail.
         */}
        <div className={cn('flex w-full', navExpanded ? 'px-3' : 'justify-center')}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleNav}
            aria-expanded={navExpanded}
            aria-controls={SIDEBAR_ID}
            // The icon carries no text, so the control needs a name of its
            // own. It says what the click will do, not what the state is.
            aria-label={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
            title={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
        </div>
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
                        ? 'bg-selected font-medium text-selected-foreground'
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

interface SidebarProps {
  expanded: boolean;
}

/**
 * A permanent 64px icon rail that widens to show labels, toggled by the burger
 * button in the header.
 *
 * It used to widen on hover and collapse again the moment the pointer left.
 * Two problems with that, and they are why it is a button now. The rail is laid
 * out in normal flow, so its width change *pushes* the content column: every
 * accidental pass of the cursor reflowed `main`, and both chart libraries re-ran
 * their `ResizeObserver` callbacks across the whole 200ms transition. And a
 * width that answers to the pointer cannot be chosen: a member who wanted the
 * labels could not keep them, and one who wanted the room could not keep that
 * either. A click settles it, and the choice is remembered.
 *
 * It never hides entirely: that would reproduce the gap `TopNav` exists to fill
 * (no navigation at all), so every destination stays reachable as an icon.
 */
function Sidebar({ expanded }: SidebarProps) {
  return (
    <aside
      id={SIDEBAR_ID}
      className={cn(
        // Pinned below the 56px header so navigation stays put while the page
        // scrolls. `self-start` is what makes `sticky` work at all: as a flex
        // child the rail would otherwise stretch to the full height of the row,
        // leaving nothing to stick — it would scroll away with the content.
        // The explicit height then bounds it to the viewport, and `overflow-y`
        // lets the list scroll inside itself once it outgrows a short window.
        'sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 self-start overflow-y-auto md:block',
        // `overflow-x-hidden` is load-bearing: labels are laid out at full
        // width for the whole 200ms transition, so without it they spill
        // across the page every time the rail narrows.
        'overflow-x-hidden border-r bg-card transition-[width] duration-200',
        expanded ? 'w-56' : 'w-16',
      )}
    >
      <nav className="space-y-6 p-3" aria-label="Main">
        {sections.map((section) => (
          <div key={section.heading}>
            {/*
             * Held in the layout at all times and only faded, rather than
             * swapped for a divider when narrow. Removing it from flow would
             * shift every link down the instant the pointer arrived, so the
             * item under the cursor would not be the one that got clicked.
             * Collapsed, the blank row it leaves is what separates the two
             * groups — and the grouping matters here, since it is the line
             * between simulated and real money.
             */}
            <p
              className={cn(
                'px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase transition-opacity duration-200',
                expanded ? 'opacity-100' : 'opacity-0',
              )}
            >
              {section.heading}
            </p>
            <ul className="space-y-1">
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    /*
                     * Only while collapsed, and only as a hint. Hovering used
                     * to widen the rail, which is how you learned what an icon
                     * meant; now that a click owns the width, eight unlabelled
                     * icons would be the only thing on offer. The real label is
                     * the link text below, which stays in the accessibility
                     * tree at both widths.
                     */
                    title={expanded ? undefined : label}
                    className={({ isActive }) =>
                      cn(
                        // `whitespace-nowrap` stops labels wrapping to two
                        // lines while the rail is mid-transition.
                        'flex items-center gap-3 rounded-md py-2 text-sm whitespace-nowrap transition-[padding,background-color,color] duration-200',
                        // Collapsed, px-6 puts the 16px icon dead centre of
                        // the 64px rail (24 + 8 = 32). The icons must not
                        // drift sideways as the panel opens.
                        expanded ? 'px-3' : 'px-6',
                        isActive
                          ? 'bg-selected font-medium text-selected-foreground'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {/* Always rendered, merely clipped — so screen readers
                          and the accessibility tree always have the label. */}
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
