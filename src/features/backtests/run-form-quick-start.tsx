import { ListChecks, X } from 'lucide-react';
import { useId, useImperativeHandle, useRef, type Ref } from 'react';

import { HelpMenu, HelpMenuItem } from '@/components/common/help-menu';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

import { RUN_FORM_QUICK_START, RUN_FORM_QUICK_START_HINTS } from './run-form-copy';

const log = createLogger('run-form-quick-start');

/** Opens the guide from outside, e.g. from a help-menu entry. */
export interface QuickStartGuideHandle {
  open: () => void;
}

/**
 * A step-by-step guide to the run form, as a pop-up.
 *
 * The `ⓘ` tips explain one section each; nothing walked a first-time user
 * through the form as a whole, in order. This does, and stays out of the way
 * until asked for from a help menu.
 *
 * Opened through a ref handle rather than an `open` prop: the run dialog's
 * comments describe how a flag synced to `showModal()` by an effect can stick,
 * and calling `showModal()` on the request avoids that. Inside the run dialog
 * it is a second native `<dialog>` stacked on the first — `showModal()` puts it
 * above in the top layer, and Escape closes only the topmost one.
 */
export function RunFormQuickStartDialog({ ref }: { ref: Ref<QuickStartGuideHandle> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Two copies can be mounted at once — the app header's and the run
  // dialog's — so the heading id must be unique per instance.
  const titleId = useId();

  useImperativeHandle(ref, () => ({
    open() {
      const dialog = dialogRef.current;
      if (!dialog) return;
      // `showModal()` throws InvalidStateError if the dialog is already open.
      if (!dialog.open) dialog.showModal();
      log.info('quick start opened');
    },
  }));

  function closeGuide() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // React bubbles synthetic events through the component tree, and the
      // run dialog's copy of this is a child of it, whose `onClose` unmounts
      // the form. Without stopping it here, closing the guide would empty the form.
      onClose={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        const dialog = dialogRef.current;
        if (!dialog || event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (!inside) closeGuide();
      }}
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(520px,calc(100vw-2rem))] overflow-y-auto rounded-[10px] border border-[var(--border-strong)] bg-card p-0 text-card-foreground shadow-[0_40px_100px_rgb(0_0_0/0.6)] backdrop:bg-background/60"
    >
      <div className="flex items-start justify-between gap-4 border-b px-5 pt-4 pb-3">
        <div className="space-y-1">
          <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">
            Quick start: running a backtest
          </h2>
          <p className="text-[12px] text-muted-foreground">
            Six steps, top to bottom through the form.
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close quick start" onClick={closeGuide}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <ol className="space-y-3.5 px-5 py-4">
        {RUN_FORM_QUICK_START.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden
              className="tabular flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
            >
              {index + 1}
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-[13px] font-medium">{step.title}</p>
              <p className="text-[12px] leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="space-y-3 border-t px-5 py-3.5">
        <ul className="list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-muted-foreground">
          {RUN_FORM_QUICK_START_HINTS.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button size="sm" onClick={closeGuide}>
            Got it
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * The `?` help menu with the run-form guide as its entry.
 *
 * Used where the guide is the only help on offer — the run dialog's header.
 * The app header builds its own `HelpMenu` so app-wide entries can join it.
 */
export function RunFormHelpMenu() {
  const guideRef = useRef<QuickStartGuideHandle>(null);
  return (
    <>
      <HelpMenu label="Run form help">
        <HelpMenuItem
          icon={<ListChecks aria-hidden />}
          onSelect={() => {
            guideRef.current?.open();
          }}
        >
          Run form quick start
        </HelpMenuItem>
      </HelpMenu>
      <RunFormQuickStartDialog ref={guideRef} />
    </>
  );
}
