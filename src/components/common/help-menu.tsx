import { CircleHelp } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * A `?` icon that opens a dropdown of help entries.
 *
 * One home for help rather than a button per guide: the run form's quick start
 * is the first entry and more are planned, so callers pass items as children
 * and the trigger stays one icon however many there are.
 *
 * Same construction as the strategy actions menu — no dropdown primitive in
 * `components/ui`, so Escape, outside-click and the `menu`/`menuitem` roles are
 * written out. Positioned absolutely, not portalled, because it also renders
 * inside the run dialog, whose `showModal()` inerts anything outside it.
 */
export function HelpMenu({
  label = 'Help',
  children,
}: {
  label?: string | undefined;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // Inside the run dialog, Escape would otherwise also cancel the dialog.
      event.preventDefault();
      setOpen(false);
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
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
        }}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          open && 'bg-accent text-foreground',
        )}
      >
        <CircleHelp className="size-[18px]" aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          // Right-aligned: both triggers sit at the right edge of their bar.
          className="absolute right-0 z-30 mt-1 min-w-52 overflow-hidden rounded-md border border-[var(--border-strong)] bg-card py-1 shadow-[0_18px_40px_rgb(0_0_0/0.45)]"
          onClick={() => {
            // Every entry opens something of its own, so any click closes this.
            setOpen(false);
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** One entry in the help menu. */
export function HelpMenuItem({
  icon,
  onSelect,
  children,
}: {
  icon: ReactNode;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
    >
      <span className="shrink-0 [&_svg]:size-3.5">{icon}</span>
      {children}
    </button>
  );
}
