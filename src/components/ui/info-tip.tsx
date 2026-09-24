import {
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { Info } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

/**
 * A small `ⓘ` beside a label that explains the thing the label names.
 *
 * Opens on hover, on keyboard focus, and on click — the last because a touch
 * screen has no hover and a tap must still work. Closes on Escape, on an
 * outside press, and when the pointer leaves both the trigger and the bubble
 * (`safePolygon` lets it cross the gap between them).
 *
 * Positioned with `strategy: 'fixed'` and no portal, deliberately. The run
 * form renders inside a native `<dialog>` opened with `showModal()`, which
 * puts the dialog in the top layer and inerts everything else — a bubble
 * portalled to `document.body` would be inert and painted behind it. A fixed
 * descendant escapes the dialog's own overflow clipping instead.
 *
 * The bubble is a `tooltip` the trigger is described by, so a screen reader
 * reads it on focus without any extra announcement.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    strategy: 'fixed',
    placement: 'top',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { handleClose: safePolygon(), move: false }),
    useFocus(context),
    useClick(context, { toggle: true }),
    useDismiss(context),
    useRole(context, { role: 'tooltip' }),
  ]);

  return (
    <>
      <button
        ref={(node) => {
          refs.setReference(node);
        }}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={open ? panelId : undefined}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        {...getReferenceProps({
          onKeyDown: (event) => {
            // The native dialog cancels on Escape as a default action; when
            // the bubble is what is open, Escape is ours.
            if (event.key === 'Escape' && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          },
        })}
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {open ? (
        <div
          ref={(node) => {
            refs.setFloating(node);
          }}
          id={panelId}
          style={floatingStyles}
          // Resets the text style it would inherit from wherever it sits: a
          // table heading is monospace, uppercase and unwrapped.
          className="z-20 max-w-xs rounded-md border border-[var(--border-strong)] bg-card px-3 py-2 text-left font-sans text-[12px] leading-relaxed font-normal tracking-normal whitespace-normal text-card-foreground normal-case shadow-[0_18px_40px_rgb(0_0_0/0.45)]"
          {...getFloatingProps()}
        >
          {children}
        </div>
      ) : null}
    </>
  );
}
