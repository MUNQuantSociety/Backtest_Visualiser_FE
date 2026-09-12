import { EllipsisVertical } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The per-strategy actions menu.
 *
 * Built here rather than on a dropdown primitive, for the same reason the run
 * and flatten dialogs are built on the native `<dialog>`: `components/ui` has
 * five primitives and none of them is a menu, and one popover for one menu is
 * not worth a new dependency. What that costs is the behaviour a library would
 * give free, so it is written out: Escape closes, a click outside closes, the
 * trigger says it owns a menu, and the items are real `menuitem`s.
 *
 * What it deliberately does not do is roving focus with arrow keys. Tab
 * already reaches every item because they are buttons in DOM order, and a
 * half-implemented arrow-key model is worse than none.
 */
export function StrategyMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          // The card behind this is itself a button that selects the strategy.
          event.stopPropagation();
          setOpen((wasOpen) => !wasOpen);
        }}
        className={cn(
          'cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          open && 'bg-accent text-foreground',
        )}
      >
        <EllipsisVertical className="size-4" aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          // Right-aligned and above the cards below it: the trigger sits at the
          // right edge of a narrow column, so a left-aligned menu would hang
          // off the panel.
          className="absolute right-0 z-30 mt-1 min-w-48 overflow-hidden rounded-md border border-[var(--border-strong)] bg-card py-1 shadow-[0_18px_40px_rgb(0_0_0/0.45)]"
          onClick={(event) => {
            event.stopPropagation();
            // Any item click closes the menu; each one either navigates or
            // opens something of its own.
            setOpen(false);
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** One row in the menu. `tone="danger"` is for the destructive one. */
export function StrategyMenuItem({
  icon,
  onSelect,
  disabled = false,
  title,
  tone = 'default',
  children,
}: {
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  title?: string | undefined;
  tone?: 'default' | 'danger';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      onClick={onSelect}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        tone === 'danger' ? 'text-[var(--loss)]' : 'text-foreground',
      )}
    >
      <span className="shrink-0 [&_svg]:size-3.5">{icon}</span>
      {children}
    </button>
  );
}
