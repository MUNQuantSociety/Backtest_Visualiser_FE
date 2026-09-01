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
export function RunBacktestDialog() {
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
      <Button onClick={openDialog}>
        <Play className="mr-2 size-4" aria-hidden />
        Run backtest
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="run-backtest-title"
        // Escape and the backdrop close the dialog without React knowing, so
        // the element's own close event is what puts the flag back in step.
        onClose={() => {
          setOpen(false);
        }}
        // A click that lands on the <dialog> itself rather than on its contents
        // is a click on the backdrop, which should dismiss.
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
        className="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-lg border bg-card p-0 text-card-foreground backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div className="space-y-1">
            <h2 id="run-backtest-title" className="font-semibold tracking-tight">
              New run
            </h2>
            <p className="text-sm text-muted-foreground">
              Pick a strategy and a window, and it runs against historical data.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={closeDialog}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        {/* Mounted only while open: the form fetches the strategy list and then
            the chosen strategy's data coverage, and the dashboard should not
            pay for either until someone actually asks to run something. */}
        <div className="p-5">{open ? <RunBacktestForm /> : null}</div>
      </dialog>
    </>
  );
}
