import { Play, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { RunBacktestForm } from './run-backtest-form';

/**
 * "Run backtest" as a header action, opening the existing form in a modal.
 *
 * Running a backtest is the point of the product, but the form only existed on
 * `/backtests` — so from the dashboard, the app's landing route, there was no
 * way to start one without first knowing to navigate somewhere else.
 *
 * This is a wrapper, not a second form. `RunBacktestForm` stays the single
 * definition of what a run needs; the dashboard just gets a door to it, and
 * `/backtests` keeps rendering it inline as before.
 *
 * Built on the native `<dialog>` rather than a new primitive or a UI library:
 * `showModal()` supplies the focus trap, Escape-to-close, background inerting
 * and the backdrop that a hand-rolled overlay would have to reimplement, and
 * the repo has no dialog dependency to reach for.
 */
interface RunBacktestDialogProps {
  /** Start with this strategy chosen. */
  initialStrategyKey?: string | undefined;
  /** The trigger's text; "Run backtest" by default. */
  label?: string | undefined;
  variant?: 'default' | 'outline' | undefined;
}

export function RunBacktestDialog({
  initialStrategyKey,
  label = 'Run backtest',
  variant = 'default',
}: RunBacktestDialogProps = {}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  /*
   * The element is the source of truth for openness, not the state flag.
   *
   * Syncing the other way — state, plus an effect calling `showModal()` — has a
   * trap: the moment the element and the flag disagree, the button sets `open`
   * to the value it already holds, so the effect never re-runs and the dialog
   * can never be opened again. Calling `showModal()` on the click means the
   * button always works no matter what the flag says.
   *
   * `open` is kept only to decide whether the form is mounted, and `onClose`
   * puts it back in step however the dialog was dismissed.
   */
  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    setOpen(true);
    // `showModal()` throws InvalidStateError if the dialog is already open.
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    // Cleared here rather than left to the element's `close` event. That event
    // is not reliably observed, and leaving the flag set keeps the form mounted
    // after dismissal, holding its strategy and coverage queries subscribed.
    // `onClose` below stays as the backstop for dismissals that bypass this —
    // Escape, principally, which the element handles on its own.
    setOpen(false);
  }

  return (
    <>
      <Button
        onClick={openDialog}
        variant={variant}
        size={variant === 'outline' ? 'sm' : 'default'}
      >
        <Play className="mr-2 size-4" aria-hidden />
        {label}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="run-backtest-title"
        // Escape and the backdrop close the dialog without React knowing, so
        // the element's own close event is what puts the flag back in step.
        onClose={() => {
          setOpen(false);
        }}
        // A backdrop click reaches the <dialog> element itself, but so does a
        // click on its own scrollbar or padding now that it scrolls. Only a
        // click whose coordinates fall outside the box is a dismissal; the
        // other kind closed the form while the element stayed open.
        onClick={(event) => {
          const dialog = dialogRef.current;
          if (!dialog || event.target !== dialog) return;
          const box = dialog.getBoundingClientRect();
          const inside =
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom;
          if (!inside) closeDialog();
        }}
        // 720px, border-strong hairline, radius 10 and a deep shadow over a
        // background-coloured backdrop at 85% — the handoff's dialog spec.
        // Taller than most viewports once a strategy shows its parameters, so it
        // scrolls inside itself; without the cap the header sits above the fold
        // and the close button with it.
        className="m-auto max-h-[calc(100vh-2rem)] w-[min(720px,calc(100vw-2rem))] overflow-y-auto rounded-[10px] border border-[var(--border-strong)] bg-card p-0 text-card-foreground shadow-[0_40px_100px_rgb(0_0_0/0.6)] backdrop:bg-background/85"
      >
        {/* Header and footer stay put while the body scrolls, so the title, the
            close button and the Run button are reachable at any scroll position
            — the dialog is taller than most viewports once parameters show. */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card px-6 pt-5 pb-4">
          <div className="space-y-1">
            <h2 id="run-backtest-title" className="text-[17px] font-semibold tracking-tight">
              Run backtest
            </h2>
            <p className="text-[13px] text-muted-foreground">
              Event-driven by default. Dates are bounded by what the data actually covers.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={closeDialog}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        {/* Mounted only while open: the form fetches the strategy list and then
            the chosen strategy's data coverage, and the dashboard should not
            pay for either until someone actually asks to run something. */}
        {open ? <RunBacktestForm layout="dialog" initialStrategyKey={initialStrategyKey} /> : null}
      </dialog>
    </>
  );
}
